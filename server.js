const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Criar tabela pessoas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pessoas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    local TEXT,
    status TEXT DEFAULT '🔴',
    hora_inicio TEXT,
    hora_fim TEXT
  )`);
});

// Listar todas pessoas em ordem alfabética
app.get('/pessoas', (req, res) => {
  db.all("SELECT * FROM pessoas ORDER BY nome ASC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao listar pessoas');
    }
    res.json(rows);
  });
});

// Adicionar pessoa
app.post('/adicionar', (req, res) => {
  const { nome, local } = req.body;
  db.run("INSERT INTO pessoas (nome, local) VALUES (?, ?)", [nome, local], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao adicionar pessoa');
    }
    res.sendStatus(200);
  });
});

// Iniciar pessoa
app.post('/iniciar', (req, res) => {
  const { id } = req.body;

  const agora = new Date();
  const horaInicio = agora.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const fim = new Date(agora.getTime() + 75 * 60000); // 1 hora e 15 min
  const horaFim = fim.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  db.run("UPDATE pessoas SET status = ?, hora_inicio = ?, hora_fim = ? WHERE id = ?",
    ['🟡', horaInicio, horaFim, id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao iniciar pessoa');
      }

      setTimeout(() => {
        db.run("UPDATE pessoas SET status = ? WHERE id = ?", ['🟢', id], (e) => {
          if (e) console.error(e);
        });
      }, 75 * 60000); // 1h15min

      res.sendStatus(200);
    });
});

// Atualizar horários manualmente
app.post('/editarHorario', (req, res) => {
  const { id, campo, valor } = req.body;

  let status = '🟡';
  const horaAtual = new Date();
  const partes = valor.split(':');
  if (partes.length === 3) {
    const editada = new Date();
    editada.setHours(parseInt(partes[0]));
    editada.setMinutes(parseInt(partes[1]));
    editada.setSeconds(parseInt(partes[2]));

    if (editada < horaAtual) {
      status = '🟢';
    }
  }

  db.run(`UPDATE pessoas SET ${campo} = ?, status = ? WHERE id = ?`, [valor, status, id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao editar horário');
    }
    res.sendStatus(200);
  });
});

// Excluir pessoa
app.post('/excluir', (req, res) => {
  db.run("DELETE FROM pessoas WHERE id = ?", [req.body.id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao excluir pessoa');
    }
    res.sendStatus(200);
  });
});

// Limpar dados
app.post('/limpar', (req, res) => {
  db.run("DELETE FROM pessoas", (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao limpar dados');
    }
    res.sendStatus(200);
  });
});

// Atualizar local
app.post('/editarLocal', (req, res) => {
  const { id, local } = req.body;
  db.run("UPDATE pessoas SET local = ? WHERE id = ?", [local, id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao atualizar local');
    }
    res.sendStatus(200);
  });
});

// Versão da API
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' });
});

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
