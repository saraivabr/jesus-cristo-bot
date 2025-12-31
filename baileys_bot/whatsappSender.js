/**
 * WhatsApp Sender - Jesus Cristo Bot
 * Funções de envio de mensagens com comportamento humanizado.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as humanizer from './humanizer.js';
import * as behaviorAnalyzer from './behaviorAnalyzer.js';
import * as db from './database.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envia mensagem com presença de "digitando" humanizada
 */
export async function sendMessage(sock, phone, text, complexity = 'medium') {
    try {
        await sock.presenceSubscribe(phone);
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sock.sendPresenceUpdate('composing', phone);
        await sleep(typingDelay);
        await sock.sendPresenceUpdate('paused', phone);
        await sock.sendMessage(phone, { text });
        console.log(`✅ [${typingDelay}ms] Mensagem enviada para ${phone}`);
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${phone}:`, error.message);
    }
}

/**
 * Envia mensagens fragmentadas com delays humanizados
 */
export async function sendFragmentedMessages(sock, phone, messages, initialComplexity = 'medium', options = {}) {
    console.log(`📨 Enviando ${messages.length} fragmentos para ${phone}`);

    for (let i = 0; i < messages.length; i++) {
        const complexity = i === 0 ? initialComplexity : 'low';
        await sendMessage(sock, phone, messages[i], complexity);

        if (i < messages.length - 1) {
            const fragmentDelay = humanizer.calculateFragmentDelay(messages[i + 1]);
            await sleep(fragmentDelay);
        }
    }

    behaviorAnalyzer.onBotMessageSent(phone);

    if (options.usuarioId && messages.length > 0) {
        try {
            db.addMensagemEnviada({
                usuarioId: options.usuarioId,
                messageKey: null,
                jid: phone,
                conteudo: messages[messages.length - 1]?.substring(0, 100)
            });
            await sock.presenceSubscribe(phone);
        } catch (e) {
            console.warn('[Sender] Erro ao registrar mensagem:', e.message);
        }
    }
}

/**
 * Envia mensagem como REPLY
 */
export async function sendReply(sock, phone, text, quotedMessage, complexity = 'medium') {
    try {
        await sock.presenceSubscribe(phone);
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sock.sendPresenceUpdate('composing', phone);
        await sleep(typingDelay);
        await sock.sendPresenceUpdate('paused', phone);

        await sock.sendMessage(phone, {
            text,
            quoted: quotedMessage
        });
        console.log(`💬 [${typingDelay}ms] Reply enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar reply:`, error.message);
        await sendMessage(sock, phone, text, complexity);
    }
}

/**
 * Envia áudio com simulação de gravação
 */
export async function sendAudio(sock, phone, audioBuffer) {
    try {
        await sock.presenceSubscribe(phone);
        await sock.sendPresenceUpdate('recording', phone);
        const recordingTime = 1500 + Math.random() * 1500;
        await sleep(recordingTime);
        await sock.sendMessage(phone, {
            audio: audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        });
        await sock.sendPresenceUpdate('paused', phone);
        console.log(`🎤 [${Math.floor(recordingTime)}ms] Áudio enviado`);
    } catch (error) {
        console.error(`❌ Erro ao enviar áudio:`, error.message);
    }
}

/**
 * Envia vídeo de boas-vindas
 */
export async function sendWelcomeVideo(sock, phone, videoPath) {
    if (!existsSync(videoPath)) {
        console.warn('⚠️ Vídeo de boas-vindas não encontrado em', videoPath);
        return false;
    }

    try {
        await sock.presenceSubscribe(phone);
        await sock.sendPresenceUpdate('recording', phone);
        await sleep(800 + Math.random() * 1200);

        const videoBuffer = await readFile(videoPath);
        await sock.sendMessage(phone, {
            video: videoBuffer,
            caption: 'Eu sou Jesus Cristo. Vem cá, quero te ouvir.',
            gifPlayback: false
        });

        await sock.sendPresenceUpdate('paused', phone);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar vídeo de boas-vindas:', error.message);
        return false;
    }
}
