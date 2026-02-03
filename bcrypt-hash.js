const bcrypt = require('bcryptjs');
const password = 'Taxi881'; // Cambia por la contraseña que quieras
bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log(hash);
});