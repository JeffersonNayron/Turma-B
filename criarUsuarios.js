const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./banco.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    senha TEXT NOT NULL
  )`);

  const insert = db.prepare("INSERT INTO usuarios (tipo, senha) VALUES (?, ?)");

  bcrypt.hash("SenhaSeguraADM", 10, (err, hash1) => {
    insert.run("adm", hash1);

    bcrypt.hash("Min@Vale", 10, (err, hash2) => {
      insert.run("equipe", hash2);
      insert.finalize(() => {
        console.log("✅ Usuários criados com sucesso.");
        db.close();
      });
    });
  });
});
