const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Obtener argumentos de la línea de comandos
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('❌ Uso: node reset-password.js <email> <nuevaContraseña>');
  console.error('   Ejemplo: node reset-password.js padre@example.com miNuevaPass123');
  process.exit(1);
}

const [email, newPassword] = args;

// Validaciones básicas
if (!email.includes('@')) {
  console.error('❌ Email inválido');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ La contraseña debe tener al menos 6 caracteres');
  process.exit(1);
}

try {
  // Conectar a la base de datos
  const dbPath = path.join(__dirname, 'contabilidad.db');
  const db = new Database(dbPath);

  // Verificar que el usuario existe
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  
  if (!user) {
    console.error(`❌ No existe ningún usuario con el email: ${email}`);
    db.close();
    process.exit(1);
  }

  // Encriptar la nueva contraseña
  const hash = bcrypt.hashSync(newPassword, 10);

  // Actualizar la contraseña
  db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hash, email);

  console.log('✅ Contraseña actualizada correctamente');
  console.log(`   Usuario: ${user.email}`);
  console.log(`   Nueva contraseña: ${newPassword}`);
  console.log('');
  console.log('⚠️  Guarda esta contraseña en un lugar seguro y compártela con el usuario.');

  db.close();
} catch (error) {
  console.error('❌ Error al resetear la contraseña:', error.message);
  process.exit(1);
}
