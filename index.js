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
require('dotenv').config();


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


// Load the configuration from config.json
let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (error) {
    console.error('Failed to load config.json:', error);
    process.exit(1);
}

async function getBearerSipni() {
    const login = Buffer.from('tthiagosmarques@gmail.com:*CMSmcrp123').toString('base64');
    try {
        const response = await axios.post('https://servicos-cloud.saude.gov.br/pni-bff/v1/autenticacao/tokenAcesso', null, {
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'DNT': '1',
                'Referer': 'https://si-pni.saude.gov.br/',
                'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                'X-Authorization': `Basic ${login}`
            },
        });
        config.SIPNI_TOKEN = response.data.refreshToken;
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));  // Save the new token to the config file
        return response.data.refreshToken;
    } catch (error) {
        console.error('Erro ao obter token:', error);
        throw error;
    }
}

async function fetchDataFromSipni(cpf, bearerToken) {
    try {
        const response = await axios.get(`https://servicos-cloud.saude.gov.br/pni-bff/v1/cidadao/cpf/${cpf}`, {
            headers: {
                'User-Agent': `Mozilla/5.0 (Windows NT ${Math.floor(Math.random() * 89) + 11}.0; Win64; x64) AppleWebKit/${Math.floor(Math.random() * 881) + 111}.${Math.floor(Math.random() * 89) + 11} (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 89) + 11}.0.0.0 Safari/537.36`,
                'Authorization': `Bearer ${bearerToken}`,
                'DNT': '1',
                'Referer': 'https://si-pni.saude.gov.br/'
            },
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao buscar dados do CPF:', error);
        if (error.response && error.response.status === 401) {
            // Token is invalid, get a new one
            const newToken = await getBearerSipni();
            // Retry fetching data with the new token
            return fetchDataFromSipni(cpf, newToken);
        }
        throw error;
    }
}

app.get('/consultar/cpf/:cpf', async (req, res) => {
    try {
        const cpf = req.params.cpf.replace(/[\s-.]/g, '');
        if (cpf.length !== 11) {
            return res.status(400).json({ error: 'Por favor, digite um CPF válido.' });
        }
        let bearerToken = config.SIPNI_TOKEN;
        if (!bearerToken) {
            console.error('SIPNI_TOKEN não está configurado no arquivo config.json');
            return res.status(500).json({ error: 'Token não configurado.' });
        }
        try {
            const response = await fetchDataFromSipni(cpf, bearerToken);
            res.json(response);
        } catch (error) {
            console.error('Erro ao processar solicitação:', error);
            if (error.response && error.response.status === 401) {
                res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
            } else {
                res.status(500).json({ error: 'Erro ao processar a solicitação.' });
            }
        }
    } catch (error) {
        console.error('Erro interno do servidor:', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

async function main() {
    const consulta = new URLSearchParams(process.argv[2]).get('consulta');
    if (!consulta) {
        return;
    }
    const cpf = consulta.replace(/[\s-.]/g, '');
    if (cpf.length !== 11) {
        return;
    }

    let bearerToken = config.SIPNI_TOKEN;
    if (!bearerToken) {
        console.error('⚠️ Token SIPNI não configurado no arquivo config.json.');
        return;
    }

    try {
        const response = await fetchDataFromSipni(cpf, bearerToken);
        if (response.records.length === 0) {
            return;
        }
        const record = response.records[0];
        // Process the data as needed, without logging it
        const result = {
            personalData: {
                cpf: record.cpf,
                cns: record.cnsDefinitivo,
                name: record.nome,
                birthDate: record.dataNascimento,
                age: new Date().getFullYear() - record.dataNascimento.split('-')[0],
                gender: record.sexo === 'M' ? 'Masculino' : 'Feminino',
                qualityGrade: record.grauQualidade || 'Sem informação',
                death: record.obito ? 'Sim' : 'Não'
            },
            phones: record.telefone ? record.telefone.map(t => `${t.ddd}${t.numero}`) : ['Sem informação'],
            address: record.endereco ? {
                street: record.endereco.logradouro || 'Sem informação',
                number: record.endereco.numero || 'Sem informação',
                neighborhood: record.endereco.bairro || 'Sem informação',
                city: record.endereco.municipio || 'Sem informação',
                state: record.endereco.siglaUf || 'Sem informação',
                zip: record.endereco.cep || 'Sem informação'
            } : 'Sem informação',
            vaccines: []
        };

        const vacinasResponse = await axios.get(`https://servicos-cloud.saude.gov.br/pni-bff/v1/calendario/cpf/${cpf}`, {
            headers: {
                'User-Agent': `Mozilla/5.0 (Windows NT ${Math.floor(Math.random() * 89) + 11}.0; Win64; x64) AppleWebKit/${Math.floor(Math.random() * 881) + 111}.${Math.floor(Math.random() * 89) + 11} (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 89) + 11}.0.0.0 Safari/537.36`,
                'Authorization': `Bearer ${bearerToken}`,
                'DNT': '1',
                'Referer': 'https://si-pni.saude.gov.br/'
            },
        });

        const vacinas = vacinasResponse.data;
        if (vacinas.code === 200 && vacinas.record.imunizacoesCampanha.imunobiologicos.length > 0) {
            vacinas.record.imunizacoesCampanha.imunobiologicos.forEach(imunobiologico => {
                imunobiologico.imunizacoes.forEach(imunizacao => {
                    result.vaccines.push({
                        type: imunizacao.esquemaDose.tipoDoseDto.descricao,
                        vaccine: imunobiologico.sigla,
                        lot: imunizacao.lote,
                        applicationDate: imunizacao.dataAplicacao
                    });
                });
            });
        } else {
            result.vaccines.push('Sem informação');
        }

        // Process result as needed
    } catch (error) {
        console.error('Erro no main:', error);
    }
}

main().catch(console.error);












app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

startClient();

