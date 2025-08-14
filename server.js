const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./banco.sqlite');

// Middleware para lidar com JSON e URL Encoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// **SERVE TODOS OS ARQUIVOS DA PASTA PUBLIC, INCLUINDO app.html e dashboard.html**
app.use(express.static(path.join(__dirname, 'public')));

// Simulação em memória para teste
let pessoas = [];
let idCounter = 1;

// Função para calcular o status de cada pessoa
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

// Rota para retornar todas as pessoas e seu status
app.get('/pessoas', (req, res) => {
  pessoas = pessoas.map(p => ({ ...p, status: calcularStatus(p) }));
  res.json(pessoas);
});

// Rota para adicionar uma nova pessoa
app.post('/adicionar', (req, res) => {
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

// Rota para iniciar a atividade de uma pessoa
app.post('/iniciar', (req, res) => {
  const { id } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  const now = moment().tz('America/Sao_Paulo');
  pessoa.hora_inicio = now.format('HH:mm:ss');
  pessoa.hora_fim = now.clone().add(75, 'minutes').format('HH:mm:ss');
  pessoa.status = '🟡';
  res.json({ sucesso: true });
});

// Rota para editar o horário de uma pessoa
app.post('/editarHorario', (req, res) => {
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

// Rota para excluir uma pessoa
app.post('/excluir', (req, res) => {
  const { id } = req.body;
  pessoas = pessoas.filter(p => p.id != id);
  res.json({ sucesso: true });
});

// Rota para limpar todos os horários
app.post('/limpar', (req, res) => {
  pessoas = pessoas.map(p => ({
    ...p,
    hora_inicio: null,
    hora_fim: null,
    status: '🔴',
    mensagem: ''
  }));
  res.json({ sucesso: true });
});

// Rota para editar o local de uma pessoa
app.post('/editarLocal', (req, res) => {
  const { id, local } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  pessoa.local = local;
  res.json({ sucesso: true });
});

// Rota para enviar uma mensagem para uma pessoa (somente Admin, mas podemos remover essa lógica)
app.post('/enviarMensagem', (req, res) => {
  const { id, mensagem } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada' });

  pessoa.mensagem = mensagem;
  res.json({ sucesso: true });
});

// Versão da API
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' });
});

// Rota direta para app.html sem autenticação
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public','app.html'));
});

// Rota direta para dashboard.html sem autenticação
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public','dashboard.html'));
});

// Rota inicial que redireciona diretamente para o app.html
app.get('/', (req, res) => {
  res.redirect('/app');
});

const porta = 8080;
app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});
