/**
 * WAHA Client Adapter
 * Converte chamadas Baileys para chamadas WAHA HTTP
 *
 * WAHA API: https://waha.devlike.ru/
 */

import fetch from 'node-fetch';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_TOKEN = process.env.WAHA_TOKEN || '';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Wrapper para chamadas WAHA API
 */
async function wahaRequest(method, path, body = null) {
    const url = `${WAHA_URL}/api/${WAHA_SESSION}${path}`;
    const headers = {
        'Content-Type': 'application/json'
    };

    if (WAHA_TOKEN) {
        headers['Authorization'] = `Bearer ${WAHA_TOKEN}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            console.error(`WAHA API Error [${response.status}]:`, await response.text());
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('WAHA Request Error:', error.message);
        return null;
    }
}

/**
 * Envia mensagem de texto via WAHA
 */
export async function sendMessage(jid, text) {
    console.log(`[WAHA] Enviando mensagem para ${jid}...`);

    const result = await wahaRequest('POST', '/messages', {
        chatId: jid,
        text: text
    });

    if (result) {
        console.log(`✅ Mensagem enviada para ${jid}`);
        return true;
    } else {
        console.error(`❌ Falha ao enviar mensagem para ${jid}`);
        return false;
    }
}

/**
 * Envia mensagens fragmentadas com delays
 */
export async function sendFragmentedMessages(jid, messages) {
    console.log(`📨 Enviando ${messages.length} fragmentos para ${jid}`);

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const success = await sendMessage(jid, msg);

        if (!success) {
            console.error(`Falha ao enviar fragmento ${i + 1}/${messages.length}`);
        }

        // Delay entre mensagens (simula humanization)
        if (i < messages.length - 1) {
            const delay = 500 + Math.random() * 1500; // 500-2000ms
            await sleep(delay);
        }
    }
}

/**
 * Marca mensagem como lida
 */
export async function markMessageAsRead(messageId) {
    return await wahaRequest('POST', `/messages/${messageId}/read`);
}

/**
 * Obtém info do bot conectado
 */
export async function getSessionInfo() {
    return await wahaRequest('GET', '/me');
}

/**
 * Desconecta a sessao
 */
export async function logout() {
    return await wahaRequest('POST', '/logout');
}

/**
 * Health check
 */
export async function healthCheck() {
    try {
        const info = await getSessionInfo();
        return info !== null;
    } catch (e) {
        return false;
    }
}

export default {
    sendMessage,
    sendFragmentedMessages,
    markMessageAsRead,
    getSessionInfo,
    logout,
    healthCheck
};
