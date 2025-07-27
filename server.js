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

// Iniciar pessoa (1h15min)
app.post('/iniciar', (req, res) => {
  const { id } = req.body;

  const inicio = new Date();
  const fim = new Date(inicio.getTime() + 75 * 60000);

  const horaInicio = inicio.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

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

      // Muda para 🟢 após 1h15
      setTimeout(() => {
        db.run("UPDATE pessoas SET status = ? WHERE id = ?", ['🟢', id], (e) => {
          if (e) console.error(e);
        });
      }, 75 * 60000);

      res.sendStatus(200);
    });
});

// Editar horário manualmente via teclado
app.post('/editarHorario', (req, res) => {
  const { id, campo, valor } = req.body;

  db.run(`UPDATE pessoas SET ${campo} = ? WHERE id = ?`, [valor, id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao editar horário');
    }

    // Recalcular status
    db.get("SELECT hora_inicio, hora_fim FROM pessoas WHERE id = ?", [id], (erro, row) => {
      if (erro || !row || !row.hora_inicio || !row.hora_fim) return;

      try {
        const agora = new Date();

        const [hI, mI] = row.hora_inicio.split(':').map(Number);
        const [hF, mF] = row.hora_fim.split(':').map(Number);

        const inicio = new Date();
        inicio.setHours(hI, mI, 0, 0);

        const fim = new Date();
        fim.setHours(hF, mF, 0, 0);

        let status = '🔴';
        if (agora >= inicio && agora <= fim) status = '🟡';
        else if (agora > fim) status = '🟢';

        db.run("UPDATE pessoas SET status = ? WHERE id = ?", [status, id], (e2) => {
          if (e2) console.error(e2);
        });
      } catch (e) {
        console.error('Erro ao processar horário manual:', e);
      }
    });

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

// Editar local
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
