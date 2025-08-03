const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const moment = require('moment-timezone');

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'VascoSenai2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2 // 2 horas
  }
}));

function garantirColunaMensagem() {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(pessoas)", (err, columns) => {
      if (err) {
        console.error('Erro ao verificar colunas:', err);
        reject(err);
        return;
      }
      const hasMensagem = columns.some(col => col.name === 'mensagem');
      if (!hasMensagem) {
        console.log("Coluna 'mensagem' não existe. Criando...");
        db.run("ALTER TABLE pessoas ADD COLUMN mensagem TEXT DEFAULT ''", (err) => {
          if (err) {
            console.error('Erro ao adicionar coluna mensagem:', err);
            reject(err);
            return;
          }
          console.log("Coluna 'mensagem' criada com sucesso.");
          resolve();
        });
      } else {
        console.log("Coluna 'mensagem' já existe.");
        resolve();
      }
    });
  });
}

function criarTabelaSeNaoExistir() {
  return new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS pessoas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      local TEXT,
      status TEXT DEFAULT '🔴',
      hora_inicio TEXT,
      hora_fim TEXT,
      mensagem TEXT DEFAULT ''
    )`, (err) => {
      if (err) {
        console.error('Erro ao criar tabela pessoas:', err);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function verificarAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ erro: 'Não autorizado' });
  }
}

function definirRotas() {

  app.post('/login', (req, res) => {
    const { senha } = req.body;
    const senhaCerta = 'LuanaDiva';

    if (senha === senhaCerta) {
      req.session.isAdmin = true;
      res.json({ sucesso: true });
    } else {
      res.status(401).json({ erro: 'Senha incorreta' });
    }
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Erro ao destruir sessão:', err);
        return res.status(500).json({ erro: 'Erro ao fazer logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ sucesso: true });
    });
  });

  app.get('/checkAdmin', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
  });

  app.get('/pessoas', (req, res) => {
    db.all("SELECT * FROM pessoas", [], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao listar pessoas' });
      }

      const agora = moment.tz('America/Sao_Paulo');
      const pessoasAtualizadas = rows.map(p => {
        let status = p.status;
        if (p.hora_inicio && p.hora_fim) {
          const inicio = moment.tz('1970-01-01 ' + p.hora_inicio, 'HH:mm:ss', 'America/Sao_Paulo');
          const fim = moment.tz('1970-01-01 ' + p.hora_fim, 'HH:mm:ss', 'America/Sao_Paulo');

          if (agora.isBefore(inicio)) {
            status = '🔴';
          } else if (agora.isSameOrAfter(fim)) {
            status = '🟢';
          } else {
            status = '🟡';
          }
        } else {
          status = '🔴';
        }

        const hora_inicio = p.hora_inicio ? moment.tz('1970-01-01 ' + p.hora_inicio, 'HH:mm:ss', 'America/Sao_Paulo').format('HH:mm:ss') : '';
        const hora_fim = p.hora_fim ? moment.tz('1970-01-01 ' + p.hora_fim, 'HH:mm:ss', 'America/Sao_Paulo').format('HH:mm:ss') : '';

        return { ...p, status, hora_inicio, hora_fim };
      });

      pessoasAtualizadas.sort((a, b) => {
        const ordemStatus = { '🔴': 1, '🟡': 2, '🟢': 3 };
        if (ordemStatus[a.status] !== ordemStatus[b.status]) {
          return ordemStatus[a.status] - ordemStatus[b.status];
        }
        return a.id - b.id;
      });

      res.json(pessoasAtualizadas);
    });
  });

  app.post('/adicionar', (req, res) => {
    const { nome, local } = req.body;
    db.run("INSERT INTO pessoas (nome, local) VALUES (?, ?)", [nome, local], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao adicionar pessoa' });
      }
      res.sendStatus(200);
    });
  });

  app.post('/iniciar', (req, res) => {
    const { id } = req.body;
    const agora = moment.tz('America/Sao_Paulo');
    const horaInicio = agora.format('HH:mm:ss');
    const horaFim = agora.clone().add(75, 'minutes').format('HH:mm:ss');

    db.run("UPDATE pessoas SET status = ?, hora_inicio = ?, hora_fim = ? WHERE id = ?",
      ['🟡', horaInicio, horaFim, id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ erro: 'Erro ao iniciar pessoa' });
        }
        setTimeout(() => {
          db.run("UPDATE pessoas SET status = ? WHERE id = ?", ['🟢', id], (e) => {
            if (e) console.error(e);
          });
        }, 75 * 60000);
        res.sendStatus(200);
      });
  });

  app.post('/editarHorario', (req, res) => {
    const { id, hora_inicio } = req.body;
    if (!id || !hora_inicio) {
      return res.status(400).json({ erro: 'id e hora_inicio são obrigatórios' });
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(hora_inicio)) {
      return res.status(400).json({ erro: 'hora_inicio inválida' });
    }

    const [h, m, s] = hora_inicio.split(':').map(Number);
    let dateInicio = moment.tz({ hour: h, minute: m, second: s }, 'America/Sao_Paulo');
    let dateFim = dateInicio.clone().add(75, 'minutes');

    const horaFim = dateFim.format('HH:mm:ss');
    const agora = moment.tz('America/Sao_Paulo');

    let status;
    if (agora.isBefore(dateInicio)) {
      status = '🔴';
    } else if (agora.isSameOrAfter(dateFim)) {
      status = '🟢';
    } else {
      status = '🟡';
    }

    db.run("UPDATE pessoas SET hora_inicio = ?, hora_fim = ?, status = ? WHERE id = ?",
      [hora_inicio, horaFim, status, id], (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ erro: 'Erro ao atualizar horário' });
        }
        res.sendStatus(200);
      });
  });

  app.post('/excluir', (req, res) => {
    db.run("DELETE FROM pessoas WHERE id = ?", [req.body.id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao excluir pessoa' });
      }
      res.sendStatus(200);
    });
  });

  app.post('/limpar', (req, res) => {
    const sql = `
      UPDATE pessoas 
      SET status = '🔴',
          hora_inicio = NULL,
          hora_fim = NULL,
          mensagem = NULL
    `;
    db.run(sql, function(err) {
      if (err) {
        console.error('Erro ao limpar dados:', err.message);
        return res.status(500).send('Erro ao limpar dados');
      }
      res.sendStatus(200);
    });
  });

  app.post('/editarLocal', (req, res) => {
    const { id, local } = req.body;
    db.run("UPDATE pessoas SET local = ? WHERE id = ?", [local, id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao atualizar local' });
      }
      res.sendStatus(200);
    });
  });

  app.post('/enviarMensagem', verificarAdmin, (req, res) => {
    const { id, mensagem } = req.body;
    if (!id || typeof mensagem !== 'string') {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }
    db.run("UPDATE pessoas SET mensagem = ? WHERE id = ?", [mensagem, id], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao salvar mensagem' });
      }
      res.json({ sucesso: true });
    });
  });

  app.get('/api/version', (req, res) => {
    res.json({ version: '1.0.0' });
  });
}

async function inicializar() {
  try {
    await criarTabelaSeNaoExistir();
    await garantirColunaMensagem();

    definirRotas();

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    process.exit(1);
  }
}

inicializar();