require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input'); // npm install input
const express = require('express');
const fs = require('fs');
const axios = require('axios')
const { JsonDatabase } = require("wio.db");
const jwt = require('jsonwebtoken');
const db = new JsonDatabase({ databasePath: `myJsonDatabase.json` });
const tokens = db.get("tokens")


const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const phoneNumber = process.env.PHONE_NUMBER;


const sessionFile = 'session.json';
let stringSession = '';

if (fs.existsSync(sessionFile)) {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    stringSession = sessionData.token;
}


const client = new TelegramClient(new StringSession(stringSession), apiId, apiHash, { connectionRetries: 5 });

async function startClient() {
    console.log('Iniciando o cliente Telegram...');
    if (stringSession === '') {
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => await input.text('Por favor, insira sua senha: '),
            phoneCode: async () => await input.text('Por favor, insira o código que você recebeu: '),
            onError: (err) => console.log(err),
        });
        const savedSession = client.session.save();
        fs.writeFileSync(sessionFile, savedSession, 'utf8');
        console.log('Sessão salva:', savedSession); // Salve esta string para evitar fazer login novamente
    } else {
        await client.connect();
        console.log('Conectado com sucesso.');
    }
}

async function sendMessageAndWaitForResponse(user, message) {
    return new Promise((resolve, reject) => {
        let receivedResponse = false;

        client.addEventHandler(async (event) => {
            const receivedMessage = event.message;

            if (receivedMessage && receivedMessage.peerId && receivedMessage.peerId.userId &&
                receivedMessage.peerId.userId.toString() === user.id.toString()) {
                receivedResponse = true;
                resolve(receivedMessage.message);
            }
        }, new NewMessage({ incoming: true }));

        (async () => {
            await client.sendMessage(user.id, { message });

            // Timeout de 60 segundos para a resposta do bot
            setTimeout(() => {
                if (!receivedResponse) {
                    reject(new Error('Tempo limite para a resposta do bot excedido.'));
                }
            }, 60000);
        })();
    });
}

const app = express();
const port = 3000;

// Middleware de verificação de token
function verifyToken(req, res, next) {
    // Implementar a lógica de verificação de token aqui
    next();
}

// Função para limpar a resposta da API
function cleanApiResponse(response) {
    let cleanedResponse = response.replace(/═/g, ''); // Remove todos os caracteres '═'
    cleanedResponse = cleanedResponse.replace(/🕵 CONSULTA DE NOME 🕵️/g, ''); // Remove o padrão específico '🕵️ CONSULTA DE NOME 🕵️'
    cleanedResponse = cleanedResponse.replace(/👤 Usuário: ../g, '');
    cleanedResponse = cleanedResponse.replace(/BY: @BINGSIXBOT/g, '');
    cleanedResponse = cleanedResponse.replace(/BY: @BINGSIXBO/g, '');
    cleanedResponse = cleanedResponse.replace(/RESULTADO/g, '');
    cleanedResponse = cleanedResponse.replace(/🕵️  𝗖𝗢𝗡𝗦𝗨𝗟𝗧𝗔 𝗥𝗘𝗔𝗟𝗜𝗭𝗔𝗗𝗔. 🕵️/g, ''); // Remove o padrão específico '👤 Usuário: ..• BY: @BINGSIXBO'
    cleanedResponse = cleanedResponse.replace(/🕵️  𝗖𝗢𝗡𝗦𝗨𝗟𝗧𝗔 𝗥𝗘𝗔𝗟𝗜𝗭𝗔𝗗A. 🕵️/g, ''); // Remove o padrão específico '👤 Usuário: ..• BY: @BINGSIXBO'
    return cleanedResponse.trim(); // Remove espaços em branco no início e no final
}

async function handleSearch(req, res, message) {
    try {
        if (!client.connected) {
            console.log('Conectando cliente...');
            await client.connect(); // Certifique-se de que o cliente está conectado
        }

        const user = await client.getEntity('BINGSIXBOT'); // Obter a entidade do bot pelo nome de usuário

        const response = await sendMessageAndWaitForResponse(user, message);
        const cleanedResponse = cleanApiResponse(response); // Função para limpar a resposta

        return res.status(200).json({ response: cleanedResponse });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return res.status(500).json({ error: 'Erro ao enviar mensagem no Telegram' });
    }
}

app.get('/consultar/', (req, res) => {

    const msg = 'Seja Bem-Vindo(a)';

    res.status(200).json({ msg });
});

app.get('/consultar/telefone/:tel', verifyToken, async (req, res) => {
    const tel = req.params.tel;
    const message = `/telefone ${tel}`;
    await handleSearch(req, res, message);
}); 

app.get('/consultar/nome/:nome', verifyToken, async (req, res) => {
    const nome = req.params.nome;
    const message = `/nome ${nome}`;
    await handleSearch(req, res, message);
});

app.get('/consultar/placa/:placa', verifyToken, async (req, res) => {
    const placa = req.params.placa;
    const message = `/placa ${placa}`;
    await handleSearch(req, res, message);
});

app.get('/consultar/cnpj/:cnpj', verifyToken, async (req, res) => {
    const cnpj = req.params.cnpj;
    const message = `/cnpj ${cnpj}`;
    await handleSearch(req, res, message);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

startClient();


