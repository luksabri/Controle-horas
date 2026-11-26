const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_USER = process.env.AUTH_USER || 'luciano';
const AUTH_PASS = process.env.AUTH_PASS || '784512';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'dados.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

app.use(express.json());

// Função middleware de autenticação (aplicada apenas nas rotas protegidas)
function exigirAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Area de Registro - Horas Extras"');
    return res.status(401).send('Autenticação necessária.');
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [user, pass] = credentials.split(':');

  if (user === AUTH_USER && pass === AUTH_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Area de Registro - Horas Extras"');
  return res.status(401).send('Usuário ou senha inválidos.');
}

// Funções auxiliares de leitura e escrita
function lerDados() {
  try {
    const conteudo = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(conteudo);
  } catch (err) {
    return [];
  }
}

function salvarDados(dados) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2), 'utf8');
}

// ==========================================
// ROTAS PÚBLICAS (Sem senha)
// ==========================================

// Página inicial de visualização
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Listar registros para visualização
app.get('/api/horas', (req, res) => {
  const dados = lerDados();
  dados.sort((a, b) => b.data.localeCompare(a.data));
  res.json(dados);
});

// ==========================================
// ROTAS PROTEGIDAS (Com Basic Auth)
// ==========================================

// Página de gerenciamento (protegida)
app.get('/admin', exigirAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Bloqueia acesso direto via URL a /admin.html sem passar pela rota /admin
app.get('/admin.html', exigirAuth, (req, res) => {
  res.redirect('/admin');
});

// Adicionar novo registro
app.post('/api/horas', exigirAuth, (req, res) => {
  const { data, minutos, observacao } = req.body;

  if (!data || typeof minutos !== 'number' || minutos <= 0) {
    return res.status(400).json({ erro: 'Data e quantidade de horas válidas são obrigatórias.' });
  }

  const dados = lerDados();
  const novoRegistro = {
    id: Date.now().toString(),
    data,
    minutos,
    observacao: (observacao || '').trim()
  };

  dados.push(novoRegistro);
  salvarDados(dados);
  res.status(201).json(novoRegistro);
});

// Editar registro existente
app.put('/api/horas/:id', exigirAuth, (req, res) => {
  const { id } = req.params;
  const { data, minutos, observacao } = req.body;

  if (!data || typeof minutos !== 'number' || minutos <= 0) {
    return res.status(400).json({ erro: 'Data e quantidade de horas válidas são obrigatórias.' });
  }

  const dados = lerDados();
  const index = dados.findIndex(item => item.id === id);

  if (index === -1) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }

  dados[index] = {
    ...dados[index],
    data,
    minutos,
    observacao: (observacao || '').trim()
  };

  salvarDados(dados);
  res.json(dados[index]);
});

// Deletar registro
app.delete('/api/horas/:id', exigirAuth, (req, res) => {
  const { id } = req.params;
  const dados = lerDados();
  const filtrados = dados.filter(item => item.id !== id);

  if (dados.length === filtrados.length) {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }

  salvarDados(filtrados);
  res.json({ sucesso: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

