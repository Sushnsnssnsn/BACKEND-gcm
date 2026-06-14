# Backend GCM Baixada Santista

Este backend recebe os formulários do site e envia para o canal do Discord:

Canal configurado:
1515488788871118929

## Arquivos

- server.js
- package.json
- .env.example
- trecho_para_colar_no_formulario.txt

## Como usar no PC

1. Instale o Node.js:
https://nodejs.org

2. Abra a pasta do backend no terminal.

3. Rode:
npm install

4. Renomeie `.env.example` para `.env`.

5. Coloque o token do bot:
DISCORD_TOKEN=seu_token_aqui

6. Ligue:
npm start

7. Teste no navegador:
http://localhost:3000

## Como deixar online

Hospede em uma plataforma como:
- Render
- Railway
- Replit
- VPS

Depois de hospedar, copie a URL do backend e coloque no formulario.html no trecho:

https://SUA-URL-DO-BACKEND-AQUI/formulario

## Importante

HTML sozinho não consegue fazer isso com segurança.
Nunca coloque o token do bot direto no site.
