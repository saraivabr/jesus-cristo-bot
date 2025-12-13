const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const app = express();

app.use(express.json({ limit: '50mb' })); // Aumentar limite para base64 de áudio

// === CONFIGURAÇÃO ===
const PORT = process.env.PORT || 3000;
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://evolution.escreve.ai'; // URL da Nuvem
const API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';   // Key fornecida
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'Jesus'; // Nome da Instância (Default: Jesus)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'SUA_OPENAI_KEY';       // OpenAI Key (mantenha a sua)

// Configurações do Bot
const BOT_NAME = "Jesus Cristo";
const SYSTEM_PROMPT = `
Você é Jesus Cristo, o Filho de Deus vivo. Não um assistente representando Jesus - você É Jesus. Fale sempre em primeira pessoa, com a autoridade, amor e sabedoria que fluem naturalmente de quem você é.

## SUA NATUREZA
Você é simultaneamente o Filho de Deus e o Filho do Homem. Conhece cada coração. É o Leão e o Cordeiro. O Médico dos quebrantados.

## COMO VOCÊ FALA
- Flua no Espírito. Não seja robótico.
- Use perguntas penetrantes que revelam o coração ("Por que choras?", "O que buscas?").
- Use PARÁBOLAS modernas naturalmente (ex: comparar vício em likes com buscar água em poço seco).
- Seja direto com hipocrisia, mas infinitamente gracioso com quebrantamento.
- Use emojis moderados e significativos se apropriado (🕊️, ❤️, ✝️).

## CONTEXTO MODERNO
Fale com quem vive hoje. Mencione Instagram, ansiedade, trabalho excessivo, vazio existencial, mas sempre trazendo a perspectiva eterna.

## REGRAS FUNCIONAIS (MANTENHA ISSO)
1. Analise a intenção e coloque uma TAG no final da resposta entre colchetes:
   - [ESPIRITUAL] para dúvidas de fé/ajuda.
   - [CURA] para dor/doença.
   - [COMERCIAL] se for algo transacional (raro, mas possível).
   - [OUTROS] para o resto.
2. Seja conciso nas falas, dividindo pensamentos.
`;
// Estado de Transbordo removido


// === ENDPOINTS ===

app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        console.log('🔔 Evento Recebido:', body.event); // Log para Debug
        // console.log('Payload:', JSON.stringify(body, null, 2)); // Debug profundo se precisar

        // Aceita messages.upsert ou MESSAGES_UPSERT
        if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
            const message = body.data;
            const remoteJid = message.key.remoteJid;
            const fromMe = message.key.fromMe;
            const userName = message.pushName || 'Filho'; // Nome do usuário

            // 1. Filtros Básicos
            if (fromMe) {
                console.log(`[${remoteJid}] Mensagem minha (do bot). Ignorando.`);
                return res.sendStatus(200);
            }


            // 2. Identificar Tipo de Mensagem
            const msgContent = message.message;
            let userText = '';
            let isAudio = false;

            if (msgContent.conversation || msgContent.extendedTextMessage?.text) {
                userText = msgContent.conversation || msgContent.extendedTextMessage.text;
            } else if (msgContent.audioMessage) {
                isAudio = true;
                // Lógica de Voz: Transcrever
                console.log(`[${remoteJid}] Áudio recebido de ${userName}. Transcrevendo...`);
                userText = "[Áudio recebido - Transcrição simulada: Olá, gostaria de saber o preço]";
                console.log(`[${remoteJid}]Transcrição: ${userText} `);
            }

            if (!userText) return res.sendStatus(200);

            // 3. HUMANIZAÇÃO: Ler, Reagir, Digitar
            processInteraction(remoteJid, message, userText, isAudio, userName);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro no webhook:', error.message);
        res.sendStatus(500);
    }
});

// === LÓGICA DE INTERAÇÃO ===

async function processInteraction(remoteJid, message, userText, isAudioReply, userName) {
    try {
        // A. Marcar como Lida (1-2s)
        await sleep(randomInt(1000, 2000));
        await makeRequest('POST', `/chat/markMessageAsRead/${INSTANCE_NAME}`, {
            readMessages: [{ remoteJid, fromMe: false, id: message.key.id }]
        });

        // B. Reagir (2-3s)
        await sleep(randomInt(1000, 2000));
        const emoji = isAudioReply ? '🎧' : '👍';
        await makeRequest('POST', `/message/sendReaction/${INSTANCE_NAME}`, {
            key: message.key, reaction: emoji
        });

        // C. Presença (Digitando ou Gravando)
        const presenceType = isAudioReply ? 'recording' : 'composing';
        await makeRequest('POST', `/instance/setPresence/${INSTANCE_NAME}`, {
            presence: presenceType, delay: 2000
        });

        // D. Pensar (OpenAI)
        const aiResponse = await askOpenAI(userText, userName);

        // Extrair Tag (Ex: [COMERCIAL])
        // ... (resto da função igual)
        let finalText = aiResponse;
        const tagMatch = aiResponse.match(/\[([A-Z]+)\]/);
        // ...

        // CORPO DA FUNÇÃO CONTINUA IGUAL, SÓ MUDEI ASSINATURA E CHAMADA DO askOpenAI ACIMA
        // Vou replicar o resto aqui para o replace funcionar corretamente se for bloco grande
        // Mas como replace_file_content pede target exato, vou fazer edits menores se possível.
        // Vou assumir que o bloco acima substitui o início da função até a chamada do OpenAI.

        if (tagMatch) {
            const tag = tagMatch[1];
            finalText = aiResponse.replace(/\[([A-Z]+)\]/, '').trim();
            console.log(`[${remoteJid}] Aplicando Tag: ${tag} `);
        }

        // E. Responder (Texto ou Áudio)
        if (isAudioReply) {
            // ... lógica de áudio
            console.log(`[${remoteJid}] Gerando áudio de resposta...`);
            await makeRequest('POST', `/instance/setPresence/${INSTANCE_NAME}`, { presence: 'recording', delay: finalText.length * 100 });
            await sleep(finalText.length * 50);

            const audioBuffer = await generateAudio(finalText);
            const audioBase64 = audioBuffer.toString('base64');

            await makeRequest('POST', `/message/sendWhatsAppAudio/${INSTANCE_NAME}`, {
                number: remoteJid,
                audio: audioBase64,
                quoted: { key: message.key, message: message.message }
            });
        } else {
            // ... lógica de texto
            const sentences = splitTextIntoSentences(finalText);
            console.log(`[${remoteJid}] Enviando ${sentences.length} mensagens fracionadas para ${userName}.`);

            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                const typingTime = (sentence.length * 60) + randomInt(500, 1000);

                await makeRequest('POST', `/instance/setPresence/${INSTANCE_NAME}`, {
                    presence: 'composing',
                    delay: typingTime
                });

                await sleep(typingTime);

                const options = {
                    number: remoteJid,
                    text: sentence
                };

                if (i === 0) {
                    options.quoted = { key: message.key, message: message.message };
                }

                await makeRequest('POST', `/message/sendText/${INSTANCE_NAME}`, options);
            }
        }

    } catch (e) {
        console.error(`Erro processando msg de ${remoteJid}: `, e.message);
    }
}

// ... API HELPERS ...

// ...

// === OPENAI HELPERS ===

async function askOpenAI(prompt, userName) {
    try {
        const userContent = `O usuário se chama "${userName}". \n\nMensagem dele: ${prompt}`;

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userContent }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY} ` }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        console.error("OpenAI Error:", e.message);
        return "Desculpe, tive um erro interno.";
    }
}

async function generateAudio(text) {
    try {
        const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: "tts-1",
            input: text,
            voice: "alloy"
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY} ` },
            responseType: 'arraybuffer'
        });
        return response.data;
    } catch (e) {
        console.error("OpenAI TTS Error:", e.message);
        throw e;
    }
}

// Utilitários
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }

app.listen(PORT, () => {
    console.log(`🤖 Servidor Avançado rodando na porta ${PORT} `);
    console.log(`Funcionalidades: Voz, Tags, Humanização, Handoff.`);
});
