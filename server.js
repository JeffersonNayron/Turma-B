const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const db = new sqlite3.Database('./banco.sqlite');

// Configuração do session
app.use(session({
  secret: 'sua_chave_secreta_aqui_123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para checar se está autenticado (opcional, pode comentar para liberar páginas)
function verificarAutenticacao(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/'); // Ou next() para liberar acesso sem restrição
}

// Middleware para checar se é admin
function verificarAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.tipo === 'adm') {
    return next();
  }
  res.status(403).json({ erro: 'Acesso negado. Apenas ADM.' });
}

// Rota login
app.post('/login', (req, res) => {
  const { senha } = req.body;
  if (!senha) return res.status(400).json({ erro: 'Senha é obrigatória' });

  db.all('SELECT * FROM usuarios', (err, rows) => {
    if (err) return res.status(500).json({ erro: 'Erro no banco' });

    let achou = false;
    for (const user of rows) {
      if (bcrypt.compareSync(senha, user.senha)) {
        req.session.user = { id: user.id, tipo: user.tipo };
        achou = true;
        return res.json({ sucesso: true, tipo: user.tipo });
      }
    }
    if (!achou) {
      return res.status(401).json({ erro: 'Senha inválida' });
    }
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ sucesso: true });
  });
});

app.get('/checkUser', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ logado: true, tipo: req.session.user.tipo });
  } else {
    res.json({ logado: false });
  }
});

// **SERVE TODOS OS ARQUIVOS DA PASTA PUBLIC, INCLUINDO app.html e dashboard.html**
app.use(express.static(path.join(__dirname, 'public')));

const fs = require('fs');

// Rota protegida para app.html
app.get('/app', verificarAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// Rota protegida para dashboard.html
app.get('/dashboard', verificarAutenticacao, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Resto do CRUD e lógica permanece igual
// Simulação em memória para teste
let pessoas = [];
let idCounter = 1;

function calcularStatus(pessoa) {
  if (!pessoa.hora_inicio) return '🔴';
  const now = moment().tz('America/Sao_Paulo');
  const inicio = moment.tz(pessoa.hora_inicio, 'HH:mm:ss', 'America/Sao_Paulo');
  const fim = pessoa.hora_fim
    ? moment.tz(pessoa.hora_fim, 'HH:mm:ss', 'America/Sao_Paulo')
    : inicio.clone().add(75, 'minutes');

  if (now.isBefore(inicio)) return '🔴';
  if (now.isBetween(inicio, fim, null, '[)')) return '🟡';
  if (now.isSameOrAfter(fim)) return '✅';

  return '🔴';
}

app.get('/pessoas', verificarAutenticacao, (req, res) => {
  pessoas = pessoas.map(p => ({ ...p, status: calcularStatus(p) }));
  res.json(pessoas);
});

app.post('/adicionar', verificarAutenticacao, (req, res) => {
  const { nome, local } = req.body;
  if (!nome || !local) return res.status(400).json({ erro: 'Nome e local obrigatórios' });
  pessoas.push({
    id: idCounter++,
    nome,
    local,
    hora_inicio: null,
    hora_fim: null,
    status: '🔴',
    mensagem: ''
  });
  res.json({ sucesso: true });
});

app.post('/iniciar', verificarAutenticacao, (req, res) => {
  const { id } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  const now = moment().tz('America/Sao_Paulo');
  pessoa.hora_inicio = now.format('HH:mm:ss');
  pessoa.hora_fim = now.clone().add(75, 'minutes').format('HH:mm:ss');
  pessoa.status = '🟡';
  res.json({ sucesso: true });
});

app.post('/editarHorario', verificarAutenticacao, (req, res) => {
  const { id, hora_inicio, hora_fim } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  if (!/^\d{2}:\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}:\d{2}$/.test(hora_fim)) {
    return res.status(400).json({ erro: 'Formato de horário inválido' });
  }

  pessoa.hora_inicio = hora_inicio;
  pessoa.hora_fim = hora_fim;
  pessoa.status = calcularStatus(pessoa);
  res.json({ sucesso: true });
});

app.post('/excluir', verificarAutenticacao, (req, res) => {
  const { id } = req.body;
  pessoas = pessoas.filter(p => p.id != id);
  res.json({ sucesso: true });
});

app.post('/limpar', verificarAutenticacao, (req, res) => {
  pessoas = pessoas.map(p => ({
    ...p,
    hora_inicio: null,
    hora_fim: null,
    status: '🔴',
    mensagem: ''
  }));
  res.json({ sucesso: true });
});

app.post('/editarLocal', verificarAutenticacao, (req, res) => {
  const { id, local } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  pessoa.local = local;
  res.json({ sucesso: true });
});

app.post('/enviarMensagem', verificarAutenticacao, verificarAdmin, (req, res) => {
  const { id, mensagem } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  pessoa.mensagem = mensagem;
  res.json({ sucesso: true });
});

app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' });
});

const porta = 3000;
app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});
