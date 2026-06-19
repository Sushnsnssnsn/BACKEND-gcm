require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sushnsnssnsn.github.io/gcm-baixada-santista';
const FRONTEND_ORIGIN = 'https://sushnsnssnsn.github.io';

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

const enviosFormulario = new Map();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_ID = process.env.CHANNEL_ID || '1515488788871118929';
const GUILD_ID = process.env.GUILD_ID || '1452744726808625318';
const OFICIAL_ROLE_ID = process.env.OFICIAL_ROLE_ID || '1452744727278649368';
const DISCORD_INVITE = process.env.DISCORD_INVITE || 'https://discord.gg/YXnn9ZrBZe';
const FORMULARIO_COOLDOWN_HORAS = Number(process.env.FORMULARIO_COOLDOWN_HORAS || 24);

// 10 anos logado, ou até clicar em Sair
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365 * 10;

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

function encodeSession(session) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

function decodeSession(value) {
  try {
    if (!value) return null;
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function getSession(req) {
  return decodeSession(req.cookies?.gcm_session);
}

function setSession(res, session) {
  res.cookie('gcm_session', encodeSession(session), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: COOKIE_MAX_AGE
  });
}

function clearSession(res) {
  res.clearCookie('gcm_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
}

app.get('/', (req, res) => {
  res.send('Backend da GCM Baixada Santista online.');
});

// LOGIN COM DISCORD
app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read'
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/auth/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login.html?erro=sem_codigo`);
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.log('Erro ao obter token OAuth2:', tokenData);
      return res.redirect(`${FRONTEND_URL}/login.html?erro=token`);
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const user = await userResponse.json();

    let inServer = false;
    let hasRole = false;
    let member = null;

    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (memberResponse.ok) {
      member = await memberResponse.json();
      inServer = true;
      hasRole = Array.isArray(member.roles) && member.roles.includes(OFICIAL_ROLE_ID);
    }

    const session = {
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar
      },
      member,
      inServer,
      hasRole,
      createdAt: Date.now()
    };

    setSession(res, session);

    return res.redirect(`${FRONTEND_URL}/painel.html`);
  } catch (erro) {
    console.error('Erro no callback Discord:', erro);
    return res.redirect(`${FRONTEND_URL}/login.html?erro=interno`);
  }
});

app.get('/me', (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({ logged: false });
  }

  return res.json({
    logged: true,
    user: session.user,
    inServer: session.inServer,
    hasRole: session.hasRole,
    invite: DISCORD_INVITE
  });
});

app.post('/logout', (req, res) => {
  clearSession(res);
  return res.json({ sucesso: true });
});

// VERIFICA SE A PESSOA PODE ABRIR O FORMULÁRIO
app.get('/pode-enviar-formulario', (req, res) => {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      pode: false,
      motivo: 'login_obrigatorio',
      mensagem: 'Você precisa fazer login com Discord para acessar o formulário.'
    });
  }

  if (!session.inServer) {
    return res.status(403).json({
      pode: false,
      motivo: 'fora_do_servidor',
      mensagem: 'Você precisa entrar no servidor da GCM para acessar o formulário.',
      invite: DISCORD_INVITE
    });
  }

  if (session.hasRole) {
    return res.status(403).json({
      pode: false,
      motivo: 'ja_tem_cargo',
      mensagem: 'Membros da GCM não podem realizar o concurso.'
    });
  }

  const userId = session.user.id;
  const ultimoEnvio = enviosFormulario.get(userId);
  const cooldownMs = FORMULARIO_COOLDOWN_HORAS * 60 * 60 * 1000;

  if (ultimoEnvio && Date.now() - ultimoEnvio < cooldownMs) {
    const faltaMs = cooldownMs - (Date.now() - ultimoEnvio);
    const faltaHoras = Math.ceil(faltaMs / (60 * 60 * 1000));

    return res.status(429).json({
      pode: false,
      motivo: 'cooldown',
      mensagem: `Você já enviou o formulário. Tente novamente em aproximadamente ${faltaHoras} hora(s).`,
      faltaHoras
    });
  }

  return res.json({
    pode: true,
    mensagem: 'Você pode realizar o formulário.'
  });
});

// ENVIO DO FORMULÁRIO
app.post('/formulario', async (req, res) => {
  try {
    const session = getSession(req);

    if (!session) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Você precisa fazer login com Discord para realizar o concurso.'
      });
    }

    if (!session.inServer) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Você precisa entrar no servidor da GCM para realizar o concurso.',
        invite: DISCORD_INVITE
      });
    }

    if (session.hasRole) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Membros da GCM não podem realizar o concurso.'
      });
    }

    const userId = session.user.id;
    const ultimoEnvio = enviosFormulario.get(userId);
    const cooldownMs = FORMULARIO_COOLDOWN_HORAS * 60 * 60 * 1000;

    if (ultimoEnvio && Date.now() - ultimoEnvio < cooldownMs) {
      const faltaMs = cooldownMs - (Date.now() - ultimoEnvio);
      const faltaHoras = Math.ceil(faltaMs / (60 * 60 * 1000));

      return res.status(429).json({
        sucesso: false,
        mensagem: `Você já enviou o formulário. Tente novamente em aproximadamente ${faltaHoras} hora(s).`
      });
    }

    const { nome, discord, idade, motivo, nota, status } = req.body;

    if (!nome || !discord || !idade || nota === undefined || !status) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Dados obrigatórios faltando.'
      });
    }

    const canal = await client.channels.fetch(CHANNEL_ID);

    if (!canal) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Canal do Discord não encontrado.'
      });
    }

    const aprovado = String(status).toLowerCase().includes('aprov');
    const nomeDiscord = session.user.global_name || session.user.username;

    const embed = new EmbedBuilder()
      .setTitle('📋 Novo Formulário do Concurso GCM')
      .setColor(aprovado ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        { name: 'Nome', value: String(nome), inline: true },
        { name: 'Discord informado', value: String(discord), inline: true },
        { name: 'Discord logado', value: `${nomeDiscord} (${session.user.id})`, inline: false },
        { name: 'Idade', value: String(idade), inline: true },
        { name: 'Motivo', value: motivo ? String(motivo) : 'Não informado' },
        { name: 'Nota', value: `${nota}/20`, inline: true },
        { name: 'Resultado', value: String(status), inline: true }
      )
      .setFooter({ text: 'Sistema de Concurso - GCM Baixada Santista' })
      .setTimestamp();

    await canal.send({ embeds: [embed] });

    enviosFormulario.set(userId, Date.now());

    return res.json({
      sucesso: true,
      mensagem: 'Formulário enviado para o Discord.'
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao enviar formulário.'
    });
  }
});

const PORT = process.env.PORT || 3000;

client.login(process.env.DISCORD_TOKEN);

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
