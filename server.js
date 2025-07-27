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

// Iniciar pessoa - muda status e horários com fuso correto
app.post('/iniciar', (req, res) => {
  const { id } = req.body;

  const now = new Date();

  const horaInicio = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const horaFimData = new Date(now.getTime() + 4500000); // 1h15min = 4.500.000 ms

  const horaFim = horaFimData.toLocaleTimeString('pt-BR', {
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

      // Após 1 hora e 15 minutos, muda status para 🟢
      setTimeout(() => {
        db.run("UPDATE pessoas SET status = ? WHERE id = ?", ['🟢', id], (e) => {
          if (e) console.error(e);
        });
      }, 4500000);

      res.sendStatus(200);
    }
  );
});

// Editar horário manualmente e ajustar status de acordo com o tempo real
app.post('/editarHorario', (req, res) => {
  const { id, hora_inicio, hora_fim } = req.body;

  const agora = new Date();

  // Converter HH:mm:ss para Date de hoje
  const [h1, m1, s1] = hora_inicio.split(':').map(Number);
  const [h2, m2, s2] = hora_fim.split(':').map(Number);

  const inicio = new Date();
  inicio.setHours(h1, m1, s1, 0);

  const fim = new Date();
  fim.setHours(h2, m2, s2, 0);

  let status = '🔴';
  if (agora >= fim) {
    status = '🟢';
  } else if (agora >= inicio && agora < fim) {
    status = '🟡';
  }

  db.run("UPDATE pessoas SET hora_inicio = ?, hora_fim = ?, status = ? WHERE id = ?",
    [hora_inicio, hora_fim, status, id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erro ao editar horário');
      }
      res.sendStatus(200);
    }
  );
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

// Atualizar local da pessoa (edição inline)
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
