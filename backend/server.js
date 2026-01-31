require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const DB_TYPE = process.env.DB_TYPE || 'sqlite';
let db, pgPool;
if (DB_TYPE === 'postgres') {
  // --- POSTGRES ---
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Las tablas se crearán si no existen (solo la primera vez)
  (async () => {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS facturas (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL REFERENCES users(id),
        codigo TEXT NOT NULL,
        fecha TEXT NOT NULL,
        empresa TEXT NOT NULL,
        cif TEXT NOT NULL,
        baseImponible REAL NOT NULL,
        porcentajeIVA REAL NOT NULL,
        valorIVA REAL NOT NULL,
        total REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS servicios (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL REFERENCES users(id),
        fecha TEXT NOT NULL,
        codigo TEXT NOT NULL,
        importe REAL NOT NULL,
        descuento REAL NOT NULL,
        importeFinal REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        cif TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(userId, nombre)
      );
      CREATE TABLE IF NOT EXISTS datosPersonales (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL UNIQUE REFERENCES users(id),
        nombre TEXT NOT NULL,
        nif TEXT NOT NULL,
        direccion TEXT,
        codigoPostal TEXT,
        ciudad TEXT,
        provincia TEXT,
        telefono TEXT,
        email TEXT,
        razonSocial TEXT,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS resetTokens (
        id SERIAL PRIMARY KEY,
        userId INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expiresAt TEXT NOT NULL,
        used INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_empresas_user_nombre ON empresas(userId, nombre);
    `);
  })();
} else {
  // --- SQLITE (local por defecto) ---
  const Database = require('better-sqlite3');
  db = new Database('contabilidad.db');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS facturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      codigo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      empresa TEXT NOT NULL,
      cif TEXT NOT NULL,
      baseImponible REAL NOT NULL,
      porcentajeIVA REAL NOT NULL,
      valorIVA REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      codigo TEXT NOT NULL,
      importe REAL NOT NULL,
      descuento REAL NOT NULL,
      importeFinal REAL NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      nombre TEXT NOT NULL COLLATE NOCASE,
      cif TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(userId, nombre)
    );
    CREATE TABLE IF NOT EXISTS datosPersonales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      nif TEXT NOT NULL,
      direccion TEXT,
      codigoPostal TEXT,
      ciudad TEXT,
      provincia TEXT,
      telefono TEXT,
      email TEXT,
      razonSocial TEXT,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS resetTokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_empresas_user_nombre ON empresas(userId, nombre);`);
}

const SECRET = process.env.JWT_SECRET || 'cambia-esto';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://lascuentasdeagustin.netlify.app'
  ],
  credentials: true
}));
app.use(express.json());

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'tu-email@gmail.com',
    pass: process.env.GMAIL_PASS || 'tu-contraseña-de-aplicacion'
  }
});

// Middleware de autenticación
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ============= AUTH =============
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Datos incompletos' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', [email, hash]);
      res.status(201).json({ id: result.rows[0].id, email });
    } else {
      const info = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hash);
      res.status(201).json({ id: info.lastInsertRowid, email });
    }
  } catch (err) {
    res.status(409).json({ error: 'Usuario ya existe' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  let user;
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT * FROM users WHERE email = $1', [email]);
    user = result.rows[0];
  } else {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Credenciales inválidas' });
  const token = jwt.sign({ sub: user.id, email }, SECRET, { expiresIn: '1d' });
  res.json({ token });
});

app.post('/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      // Por seguridad, no revelar si el usuario existe
      return res.json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hora

    // Guardar token
    db.prepare('INSERT INTO resetTokens (userId, token, expiresAt) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    // URL del frontend (ajusta según tu configuración)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/reset-password?token=${token}`;

    // Enviar email
    const mailOptions = {
      from: process.env.GMAIL_USER || 'tu-email@gmail.com',
      to: user.email,
      subject: 'Recuperación de contraseña - Contabilidad App',
      html: `
        <h2>Recuperación de contraseña</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6cc1ff; color: white; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, ignora este email.</p>
      `
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error('Error al enviar email:', error);
        return res.status(500).json({ error: 'Error al enviar el email' });
      }
      res.json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
    });

  } catch (err) {
    console.error('Error en forgot-password:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

app.post('/auth/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Buscar token válido
    const resetToken = db.prepare(`
      SELECT * FROM resetTokens 
      WHERE token = ? AND used = 0 AND datetime(expiresAt) > datetime('now')
    `).get(token);

    if (!resetToken) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    // Actualizar contraseña
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, resetToken.userId);

    // Marcar token como usado
    db.prepare('UPDATE resetTokens SET used = 1 WHERE id = ?').run(resetToken.id);

    res.json({ message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    console.error('Error en reset-password:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

// ============= FACTURAS =============
app.get('/facturas', auth, async (req, res) => {
  try {
    const limit = Math.max(1, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { desde, hasta, empresa } = req.query;

    if (DB_TYPE === 'postgres') {
      let where = 'userId = $1';
      const params = [req.user.sub];
      let idx = 2;
      if (desde) { where += ` AND fecha >= $${idx}`; params.push(desde); idx++; }
      if (hasta) { where += ` AND fecha <= $${idx}`; params.push(hasta); idx++; }
      if (empresa) { where += ` AND LOWER(empresa) LIKE $${idx}`; params.push(`%${empresa.toLowerCase()}%`); idx++; }
      const total = (await pgPool.query(`SELECT COUNT(*) AS c FROM facturas WHERE ${where}`, params)).rows[0].c;
      const suma  = (await pgPool.query(`SELECT COALESCE(SUM(total),0) AS s FROM facturas WHERE ${where}`, params)).rows[0].s;
      const datos = (await pgPool.query(`SELECT * FROM facturas WHERE ${where} ORDER BY fecha DESC, id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset])).rows;
      res.json({ datos, total, suma });
    } else {
      let where = 'userId = ?';
      const params = [req.user.sub];
      if (desde) { where += ' AND date(substr(fecha,1,10)) >= date(?)'; params.push(desde); }
      if (hasta) { where += ' AND date(substr(fecha,1,10)) <= date(?)'; params.push(hasta); }
      if (empresa) { where += ' AND LOWER(empresa) LIKE ?'; params.push(`%${empresa.toLowerCase()}%`); }
      const total = db.prepare(`SELECT COUNT(*) AS c FROM facturas WHERE ${where}`).get(...params).c;
      const suma  = db.prepare(`SELECT COALESCE(SUM(total),0) AS s FROM facturas WHERE ${where}`).get(...params).s;
      const datos = db.prepare(`
        SELECT * FROM facturas WHERE ${where}
        ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?
      `).all(...params, limit, offset);
      res.json({ datos, total, suma });
    }
  } catch (err) {
    console.error('GET /facturas', err);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

app.post('/facturas', auth, async (req, res) => {
  try {
    const { codigo, fecha, empresa, cif, baseImponible, porcentajeIVA } = req.body || {};
    if (!codigo || !fecha || !empresa || !cif || baseImponible == null || porcentajeIVA == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const valorIVA = Number(baseImponible) * (Number(porcentajeIVA) / 100);
    const total = Number(baseImponible) + valorIVA;
    if (DB_TYPE === 'postgres') {
      // Guardar empresa
      await pgPool.query(`INSERT INTO empresas (userId, nombre, cif, updatedAt) VALUES ($1, $2, $3, $4) ON CONFLICT (userId, nombre) DO NOTHING`, [req.user.sub, empresa, cif, new Date().toISOString()]);
      // Insertar factura
      const result = await pgPool.query(`INSERT INTO facturas (userId, codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [req.user.sub, codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total]);
      res.status(201).json(result.rows[0]);
    } else {
      db.prepare(`INSERT OR IGNORE INTO empresas (userId, nombre, cif, updatedAt) VALUES (?, ?, ?, ?)`).run(req.user.sub, empresa, cif, new Date().toISOString());
      const info = db.prepare(`INSERT INTO facturas (userId, codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.sub, codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total);
      const inserted = db.prepare('SELECT * FROM facturas WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(inserted);
    }
  } catch (err) {
    console.error('Error POST facturas:', err.message);
    res.status(500).json({ error: 'Error al guardar factura' });
  }
});

app.get('/facturas/:id', auth, async (req, res) => {
  try {
    let factura;
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('SELECT * FROM facturas WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      factura = result.rows[0];
    } else {
      factura = db.prepare('SELECT * FROM facturas WHERE id = ? AND userId = ?').get(req.params.id, req.user.sub);
    }
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(factura);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

app.put('/facturas/:id', auth, async (req, res) => {
  try {
    const { codigo, fecha, empresa, cif, baseImponible, porcentajeIVA } = req.body || {};
    if (!codigo || !fecha || !empresa || !cif || baseImponible == null || porcentajeIVA == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const valorIVA = Number(baseImponible) * (Number(porcentajeIVA) / 100);
    const total = Number(baseImponible) + valorIVA;
    if (DB_TYPE === 'postgres') {
      // Guardar empresa
      await pgPool.query(`INSERT INTO empresas (userId, nombre, cif, updatedAt) VALUES ($1, $2, $3, $4) ON CONFLICT (userId, nombre) DO NOTHING`, [req.user.sub, empresa, cif, new Date().toISOString()]);
      // Actualizar factura
      await pgPool.query(`UPDATE facturas SET codigo=$1, fecha=$2, empresa=$3, cif=$4, baseImponible=$5, porcentajeIVA=$6, valorIVA=$7, total=$8 WHERE id=$9 AND userId=$10`, [codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total, req.params.id, req.user.sub]);
      const result = await pgPool.query('SELECT * FROM facturas WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } else {
      db.prepare(`INSERT OR IGNORE INTO empresas (userId, nombre, cif, updatedAt) VALUES (?, ?, ?, ?)`).run(req.user.sub, empresa, cif, new Date().toISOString());
      db.prepare(`UPDATE facturas SET codigo = ?, fecha = ?, empresa = ?, cif = ?, baseImponible = ?, porcentajeIVA = ?, valorIVA = ?, total = ? WHERE id = ? AND userId = ?`).run(codigo, fecha, empresa, cif, baseImponible, porcentajeIVA, valorIVA, total, req.params.id, req.user.sub);
      const updated = db.prepare('SELECT * FROM facturas WHERE id = ?').get(req.params.id);
      res.json(updated);
    }
  } catch (err) {
    console.error('Error PUT facturas:', err.message);
    res.status(500).json({ error: 'Error al actualizar factura' });
  }
});

app.delete('/facturas/:id', auth, async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('SELECT * FROM facturas WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
      await pgPool.query('DELETE FROM facturas WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      res.json({ message: 'Factura eliminada' });
    } else {
      const factura = db.prepare('SELECT * FROM facturas WHERE id = ? AND userId = ?').get(req.params.id, req.user.sub);
      if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
      db.prepare('DELETE FROM facturas WHERE id = ? AND userId = ?').run(req.params.id, req.user.sub);
      res.json({ message: 'Factura eliminada' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar factura' });
  }
});

// ============= SERVICIOS =============
app.get('/servicios', auth, async (req, res) => {
  try {
    const limit = Math.max(1, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const { desde, hasta } = req.query;
    if (DB_TYPE === 'postgres') {
      let where = 'userId = $1';
      const params = [req.user.sub];
      let idx = 2;
      if (desde) { where += ` AND fecha >= $${idx}`; params.push(desde); idx++; }
      if (hasta) { where += ` AND fecha <= $${idx}`; params.push(hasta); idx++; }
      const total = (await pgPool.query(`SELECT COUNT(*) AS c FROM servicios WHERE ${where}`, params)).rows[0].c;
      const suma = (await pgPool.query(`SELECT COALESCE(SUM(importeFinal), 0) AS s FROM servicios WHERE ${where}`, params)).rows[0].s;
      const datos = (await pgPool.query(`SELECT * FROM servicios WHERE ${where} ORDER BY fecha DESC, id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset])).rows;
      res.json({ datos, total, suma });
    } else {
      let where = 'userId = ?';
      const params = [req.user.sub];
      if (desde) { where += ' AND date(substr(fecha,1,10)) >= date(?)'; params.push(desde); }
      if (hasta) { where += ' AND date(substr(fecha,1,10)) <= date(?)'; params.push(hasta); }
      const total = db.prepare(`SELECT COUNT(*) AS c FROM servicios WHERE ${where}`).get(...params).c;
      const suma = db.prepare(`SELECT COALESCE(SUM(importeFinal), 0) AS s FROM servicios WHERE ${where}`).get(...params).s;
      const datos = db.prepare(`
        SELECT * FROM servicios WHERE ${where}
        ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?
      `).all(...params, limit, offset);
      res.json({ datos, total, suma });
    }
  } catch (err) {
    console.error('GET /servicios', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

app.post('/servicios', auth, async (req, res) => {
  try {
    const { fecha, codigo, importe, descuento } = req.body || {};
    if (!fecha || !codigo || importe == null || descuento == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const importeFinal = Number(importe) - Number(importe) * (Number(descuento) / 100);
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query(`INSERT INTO servicios (userId, fecha, codigo, importe, descuento, importeFinal) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [req.user.sub, fecha, codigo, importe, descuento, importeFinal]);
      res.status(201).json(result.rows[0]);
    } else {
      const info = db.prepare(`INSERT INTO servicios (userId, fecha, codigo, importe, descuento, importeFinal) VALUES (?, ?, ?, ?, ?, ?)`).run(req.user.sub, fecha, codigo, importe, descuento, importeFinal);
      const inserted = db.prepare('SELECT * FROM servicios WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json(inserted);
    }
  } catch (err) {
    console.error('Error POST servicios:', err.message);
    res.status(500).json({ error: 'Error al guardar servicio' });
  }
});

app.get('/servicios/:id', auth, async (req, res) => {
  try {
    let servicio;
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('SELECT * FROM servicios WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      servicio = result.rows[0];
    } else {
      servicio = db.prepare('SELECT * FROM servicios WHERE id = ? AND userId = ?').get(req.params.id, req.user.sub);
    }
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(servicio);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener servicio' });
  }
});

app.put('/servicios/:id', auth, async (req, res) => {
  try {
    const { fecha, codigo, importe, descuento } = req.body || {};
    if (!fecha || !codigo || importe == null || descuento == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const importeFinal = Number(importe) - Number(importe) * (Number(descuento) / 100);
    if (DB_TYPE === 'postgres') {
      await pgPool.query(`UPDATE servicios SET fecha=$1, codigo=$2, importe=$3, descuento=$4, importeFinal=$5 WHERE id=$6 AND userId=$7`, [fecha, codigo, importe, descuento, importeFinal, req.params.id, req.user.sub]);
      const result = await pgPool.query('SELECT * FROM servicios WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } else {
      const servicio = db.prepare('SELECT * FROM servicios WHERE id = ? AND userId = ?').get(req.params.id, req.user.sub);
      if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
      db.prepare(`UPDATE servicios SET fecha = ?, codigo = ?, importe = ?, descuento = ?, importeFinal = ? WHERE id = ? AND userId = ?`).run(fecha, codigo, importe, descuento, importeFinal, req.params.id, req.user.sub);
      const updated = db.prepare('SELECT * FROM servicios WHERE id = ?').get(req.params.id);
      res.json(updated);
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

app.delete('/servicios/:id', auth, async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('SELECT * FROM servicios WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
      await pgPool.query('DELETE FROM servicios WHERE id = $1 AND userId = $2', [req.params.id, req.user.sub]);
      res.json({ message: 'Servicio eliminado' });
    } else {
      const servicio = db.prepare('SELECT * FROM servicios WHERE id = ? AND userId = ?').get(req.params.id, req.user.sub);
      if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
      db.prepare('DELETE FROM servicios WHERE id = ? AND userId = ?').run(req.params.id, req.user.sub);
      res.json({ message: 'Servicio eliminado' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

// ============= REPORTES =============
app.get('/reportes/servicios', auth, (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const limit = Math.max(1, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    let where = 'userId = ?';
    const params = [req.user.sub];

    if (desde) { where += ' AND date(substr(fecha,1,10)) >= date(?)'; params.push(desde); }
    if (hasta) { where += ' AND date(substr(fecha,1,10)) <= date(?)'; params.push(hasta); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM servicios WHERE ${where}`).get(...params).c;
    const datos = db.prepare(`
      SELECT * FROM servicios WHERE ${where}
      ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ datos, total });
  } catch (err) {
    console.error('Error reportes servicios:', err.message);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

app.get('/reportes/facturas', auth, (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const limit = Math.max(1, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    let where = 'userId = ?';
    const params = [req.user.sub];

    if (desde) { where += ' AND date(substr(fecha,1,10)) >= date(?)'; params.push(desde); }
    if (hasta) { where += ' AND date(substr(fecha,1,10)) <= date(?)'; params.push(hasta); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM facturas WHERE ${where}`).get(...params).c;
    const datos = db.prepare(`
      SELECT * FROM facturas WHERE ${where}
      ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ datos, total });
  } catch (err) {
    console.error('Error reportes facturas:', err.message);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
});

// ============= EMPRESAS =============
app.get('/empresas', auth, async (req, res) => {
  const nombre = (req.query.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT cif FROM empresas WHERE userId = $1 AND nombre = $2', [req.user.sub, nombre]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'no encontrado' });
    res.json({ cif: row.cif });
  } else {
    const row = db.prepare('SELECT cif FROM empresas WHERE userId = ? AND nombre = ?').get(req.user.sub, nombre);
    if (!row) return res.status(404).json({ error: 'no encontrado' });
    res.json({ cif: row.cif });
  }
});

app.get('/empresas/search', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  const like = q ? `${q}%` : '%';
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT nombre, cif FROM empresas WHERE userId = $1 AND nombre LIKE $2 ORDER BY nombre LIMIT 20', [req.user.sub, like]);
    res.json(result.rows);
  } else {
    const rows = db.prepare('SELECT nombre, cif FROM empresas WHERE userId = ? AND nombre LIKE ? ORDER BY nombre LIMIT 20').all(req.user.sub, like);
    res.json(rows);
  }
});

app.post('/empresas', auth, async (req, res) => {
  const { nombre, cif } = req.body || {};
  if (!nombre?.trim() || !cif?.trim()) return res.status(400).json({ error: 'nombre y cif requeridos' });
  const now = new Date().toISOString();
  if (DB_TYPE === 'postgres') {
    await pgPool.query(`INSERT INTO empresas (userId, nombre, cif, updatedAt) VALUES ($1, $2, $3, $4) ON CONFLICT (userId, nombre) DO UPDATE SET cif = EXCLUDED.cif, updatedAt = EXCLUDED.updatedAt`, [req.user.sub, nombre.trim(), cif.trim().toUpperCase(), now]);
    res.json({ ok: true });
  } else {
    db.prepare('INSERT INTO empresas (userId, nombre, cif, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(userId, nombre) DO UPDATE SET cif = excluded.cif, updatedAt = excluded.updatedAt').run(req.user.sub, nombre.trim(), cif.trim().toUpperCase(), now);
    res.json({ ok: true });
  }
});

app.get('/empresas/all', auth, async (req, res) => {
  if (DB_TYPE === 'postgres') {
    const result = await pgPool.query('SELECT nombre, cif FROM empresas WHERE userId = $1 ORDER BY nombre', [req.user.sub]);
    res.json(result.rows);
  } else {
    const rows = db.prepare('SELECT nombre, cif FROM empresas WHERE userId = ? ORDER BY nombre').all(req.user.sub);
    res.json(rows);
  }
});

// ============= DATOS PERSONALES =============
app.get('/datosPersonales', auth, async (req, res) => {
  try {
    let datos;
    if (DB_TYPE === 'postgres') {
      const result = await pgPool.query('SELECT * FROM datosPersonales WHERE userId = $1', [req.user.sub]);
      datos = result.rows[0];
    } else {
      datos = db.prepare('SELECT * FROM datosPersonales WHERE userId = ?').get(req.user.sub);
    }
    if (!datos) return res.status(404).json({ error: 'Datos personales no encontrados' });
    res.json(datos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener datos personales' });
  }
});

app.post('/datosPersonales', auth, async (req, res) => {
  try {
    const { nombre, nif, direccion, codigoPostal, ciudad, provincia, telefono, email, razonSocial } = req.body || {};
    if (!nombre?.trim() || !nif?.trim()) {
      return res.status(400).json({ error: 'Nombre y NIF son requeridos' });
    }
    const now = new Date().toISOString();
    if (DB_TYPE === 'postgres') {
      const existente = await pgPool.query('SELECT id FROM datosPersonales WHERE userId = $1', [req.user.sub]);
      if (existente.rows[0]) {
        await pgPool.query(`UPDATE datosPersonales SET nombre=$1, nif=$2, direccion=$3, codigoPostal=$4, ciudad=$5, provincia=$6, telefono=$7, email=$8, razonSocial=$9, updatedAt=$10 WHERE userId=$11`, [nombre.trim(), nif.trim().toUpperCase(), direccion?.trim() || '', codigoPostal?.trim() || '', ciudad?.trim() || '', provincia?.trim() || '', telefono?.trim() || '', email?.trim() || '', razonSocial?.trim() || '', now, req.user.sub]);
      } else {
        await pgPool.query(`INSERT INTO datosPersonales (userId, nombre, nif, direccion, codigoPostal, ciudad, provincia, telefono, email, razonSocial, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [req.user.sub, nombre.trim(), nif.trim().toUpperCase(), direccion?.trim() || '', codigoPostal?.trim() || '', ciudad?.trim() || '', provincia?.trim() || '', telefono?.trim() || '', email?.trim() || '', razonSocial?.trim() || '', now]);
      }
      res.json({ ok: true });
    } else {
      const existente = db.prepare('SELECT id FROM datosPersonales WHERE userId = ?').get(req.user.sub);
      if (existente) {
        db.prepare(`UPDATE datosPersonales SET nombre = ?, nif = ?, direccion = ?, codigoPostal = ?, ciudad = ?, provincia = ?, telefono = ?, email = ?, razonSocial = ?, updatedAt = ? WHERE userId = ?`).run(nombre.trim(), nif.trim().toUpperCase(), direccion?.trim() || '', codigoPostal?.trim() || '', ciudad?.trim() || '', provincia?.trim() || '', telefono?.trim() || '', email?.trim() || '', razonSocial?.trim() || '', now, req.user.sub);
      } else {
        db.prepare(`INSERT INTO datosPersonales (userId, nombre, nif, direccion, codigoPostal, ciudad, provincia, telefono, email, razonSocial, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.sub, nombre.trim(), nif.trim().toUpperCase(), direccion?.trim() || '', codigoPostal?.trim() || '', ciudad?.trim() || '', provincia?.trim() || '', telefono?.trim() || '', email?.trim() || '', razonSocial?.trim() || '', now);
      }
      res.json({ ok: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar datos personales' });
  }
});

// ============= START SERVER =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API escuchando en http://localhost:${PORT}`));