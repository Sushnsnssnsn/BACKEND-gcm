require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const app = express();

app.use(cors());
app.use(express.json());

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_ID = process.env.CHANNEL_ID || '1515488788871118929';

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

app.get('/', (req, res) => {
  res.send('Backend da GCM Baixada Santista online.');
});

app.post('/formulario', async (req, res) => {
  try {    // Verifica se está logado
    const sessionId = req.cookies?.gcm_session;
    const session = sessions?.get(sessionId);

    if (!session) {
      return res.status(401).json({
        erro: 'Você precisa fazer login para realizar o concurso.'
      });
    }

    // Bloqueia quem já possui o cargo
    if (session.hasRole) {
      return res.status(403).json({
        erro: 'Membros da GCM não podem realizar o concurso.'
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

    const embed = new EmbedBuilder()
      .setTitle('📋 Novo Formulário do Concurso GCM')
      .setColor(aprovado ? 0x2ecc71 : 0xe74c3c)
      .addFields(
        { name: 'Nome', value: String(nome), inline: true },
        { name: 'Discord', value: String(discord), inline: true },
        { name: 'Idade', value: String(idade), inline: true },
        { name: 'Motivo', value: motivo ? String(motivo) : 'Não informado' },
        { name: 'Nota', value: `${nota}/10`, inline: true },
        { name: 'Resultado', value: String(status), inline: true }
      )
      .setFooter({ text: 'Sistema de Concurso - GCM Baixada Santista' })
      .setTimestamp();

    await canal.send({ embeds: [embed] });

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
