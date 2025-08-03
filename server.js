const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const path = require('path'); // Para manipulação de caminhos de arquivos
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Simulação de banco de dados em memória
let pessoas = [];
let idCounter = 1;

// Função para calcular status baseado no horário atual e horários da pessoa
function calcularStatus(pessoa) {
  if (!pessoa.hora_inicio) return '🔴';  // Pendente (Emoji de Círculo Amarelo)

  const now = moment().tz('America/Sao_Paulo'); // hora atual em Brasília

  const inicio = moment.tz(pessoa.hora_inicio, 'HH:mm:ss', 'America/Sao_Paulo');
  const fim = pessoa.hora_fim
    ? moment.tz(pessoa.hora_fim, 'HH:mm:ss', 'America/Sao_Paulo')
    : inicio.clone().add(75, 'minutes');

  if (now.isBefore(inicio)) return '🔴';  // Pendente
  if (now.isBetween(inicio, fim, null, '[)')) return '🟡';  // Em Andamento (Emoji de Círculo Verde)
  if (now.isSameOrAfter(fim)) return '✅';  // Concluído (Emoji de Círculo Verde com Check)

  return '🔴';  // Pendente
}

// Rota para obter pessoas
app.get('/pessoas', (req, res) => {
  // Atualiza o status de cada pessoa
  pessoas = pessoas.map(p => ({
    ...p,
    status: calcularStatus(p)
  }));
  res.json(pessoas);
});

// Adicionar pessoa
app.post('/adicionar', (req, res) => {
  const { nome, local } = req.body;
  if (!nome || !local) {
    return res.status(400).json({ error: 'Nome e local são obrigatórios' });
  }

  pessoas.push({
    id: idCounter++,
    nome,
    local,
    hora_inicio: null,
    hora_fim: null,
    status: '🔴',  // Pendente (Emoji de Círculo Amarelo)
    mensagem: ''
  });

  res.status(201).json({ success: true });
});

// Iniciar (setar hora_inicio e hora_fim)
app.post('/iniciar', (req, res) => {
  const { id } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ error: 'Pessoa não encontrada' });

  const now = moment().tz('America/Sao_Paulo');
  pessoa.hora_inicio = now.format('HH:mm:ss');
  pessoa.hora_fim = now.clone().add(75, 'minutes').format('HH:mm:ss');
  pessoa.status = '🟡';  // Em Andamento (Emoji de Círculo Verde)

  res.json({ success: true });
});

// Editar horário (hora_inicio e hora_fim)
app.post('/editarHorario', (req, res) => {
  const { id, hora_inicio, hora_fim } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ error: 'Pessoa não encontrada' });

  // Validar formato HH:mm:ss simples (pode ser melhorado)
  if (!/^\d{2}:\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}:\d{2}$/.test(hora_fim)) {
    return res.status(400).json({ error: 'Formato de horário inválido' });
  }

  pessoa.hora_inicio = hora_inicio;
  pessoa.hora_fim = hora_fim;
  pessoa.status = calcularStatus(pessoa);

  res.json({ success: true });
});

// Excluir pessoa
app.post('/excluir', (req, res) => {
  const { id } = req.body;
  pessoas = pessoas.filter(p => p.id != id);
  res.json({ success: true });
});

// Limpar todos os dados
app.post('/limpar', (req, res) => {
  pessoas = [];
  idCounter = 1;
  res.json({ success: true });
});

// Editar local
app.post('/editarLocal', (req, res) => {
  const { id, local } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ error: 'Pessoa não encontrada' });

  pessoa.local = local;
  res.json({ success: true });
});

// Enviar mensagem
app.post('/enviarMensagem', (req, res) => {
  const { id, mensagem } = req.body;
  const pessoa = pessoas.find(p => p.id == id);
  if (!pessoa) return res.status(404).json({ error: 'Pessoa não encontrada' });

  pessoa.mensagem = mensagem;
  res.json({ success: true });
});

// API versão
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' });
});

// Iniciar o servidor
app.listen(8080, () => {
  console.log(`Servidor rodando na porta 8080`);
});
