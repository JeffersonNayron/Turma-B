const express = require('express');
const path = require('path');

const app = express();
const porta = 8080;

// Servir arquivos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rotas diretas
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/local', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'local.html'));
});

// Rota inicial -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
