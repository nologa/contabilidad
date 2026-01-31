const Database = require('better-sqlite3');

const db = new Database('contabilidad.db');

db.prepare("UPDATE users SET email = 'noelialgaliana@gmail.com' WHERE email = 'padre@example.com'").run();

const users = db.prepare('SELECT * FROM users').all();
console.log('Usuarios actualizados:');
console.table(users);

db.close();
