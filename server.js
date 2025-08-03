const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const moment = require('moment-timezone');  // Agora o moment-timezone está sendo importado

const app = express();
const db = new sqlite3.Database('./database.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sessão
app.use(session({
  secret: 'VascoSenai2025', // altere para algo forte
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2 // 2 horas
  }
}));

// Função que retorna Promise para garantir coluna mensagem
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

// Função para criar tabela pessoas se não existir (retorna Promise)
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

// Middleware para proteger rotas admin
function verificarAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ erro: 'Não autorizado' });
  }
}

// Definição das rotas - já fora do callback!
function definirRotas() {

  // Login
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

  // Logout
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

  // Verificar se admin está logado
  app.get('/checkAdmin', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
  });

// Listar pessoas (aberto)
app.get('/pessoas', (req, res) => {
  db.all("SELECT * FROM pessoas ORDER BY CASE WHEN status = '🔴' THEN 1 WHEN status = '🟡' THEN 2 ELSE 3 END, id ASC", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ erro: 'Erro ao listar pessoas' });
    }

    // Converter as datas para o fuso horário de São Paulo antes de retornar
    const pessoasComHorariosCorretos = rows.map(p => {
      // Verificar se hora_inicio e hora_fim existem e são válidos
      if (p.hora_inicio && p.hora_fim) {
        // Garantir que as horas sejam tratadas corretamente
        p.hora_inicio = moment(p.hora_inicio, 'HH:mm:ss', true).isValid() ? moment('1970-01-01 ' + p.hora_inicio).tz('America/Sao_Paulo').format('HH:mm:ss') : '';
        p.hora_fim = moment(p.hora_fim, 'HH:mm:ss', true).isValid() ? moment('1970-01-01 ' + p.hora_fim).tz('America/Sao_Paulo').format('HH:mm:ss') : '';
      } else {
        p.hora_inicio = '';
        p.hora_fim = '';
      }

      return p;
    });

    res.json(pessoasComHorariosCorretos);
  });
});




  // Adicionar pessoa (**SEM proteção admin**)
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

  // Iniciar pessoa (**SEM proteção admin**)
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
    const fim = new Date(agora.getTime() + 75 * 60000);
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

// Editar horário (**SEM proteção admin**)
app.post('/editarHorario', (req, res) => {
  const { id, hora_inicio } = req.body;
  if (!id || !hora_inicio) {
    return res.status(400).json({ erro: 'id e hora_inicio são obrigatórios' });
  }
  if (!/^\d{2}:\d{2}:\d{2}$/.test(hora_inicio)) {
    return res.status(400).json({ erro: 'hora_inicio inválida' });
  }

  const [h, m, s] = hora_inicio.split(':').map(Number);
  let dateInicio = new Date();
  dateInicio.setHours(h, m, s, 0);
  let dateFim = new Date(dateInicio.getTime() + 75 * 60000);
  
  // Formatar horaFim corretamente
  const pad = n => n.toString().padStart(2, '0');
  const horaFim = `${pad(dateFim.getHours())}:${pad(dateFim.getMinutes())}:${pad(dateFim.getSeconds())}`;

  const agora = new Date();
  let status = '🟡'; // Status inicial

  // Lógica de alteração de status
  if (dateFim < agora) {
    status = '🟢'; // Finalizado
  } else if (dateInicio > agora) {
    status = '🔴'; // Não iniciado
  }

  // Atualizar o banco de dados
  db.run("UPDATE pessoas SET hora_inicio = ?, hora_fim = ?, status = ? WHERE id = ?",
    [hora_inicio, horaFim, status, id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao atualizar horário' });
      }
      res.sendStatus(200);
    });
});


  // Excluir pessoa (**SEM proteção admin**)
  app.post('/excluir', (req, res) => {
    db.run("DELETE FROM pessoas WHERE id = ?", [req.body.id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao excluir pessoa' });
      }
      res.sendStatus(200);
    });
  });

  // Limpar dados (**SEM proteção admin**)
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

  // Editar local (**SEM proteção admin**)
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

  // Enviar mensagem (SOMENTE ADMIN)
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

  // Versão API pública
  app.get('/api/version', (req, res) => {
    res.json({ version: '1.0.0' });
  });
}

// Inicialização geral (async/await)
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
