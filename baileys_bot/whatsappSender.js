/**
 * WhatsApp Sender - Jesus Cristo Bot
 * Funções de envio de mensagens com comportamento humanizado via WAHA HTTP API.
 *
 * Utiliza WAHA HTTP API para envio de mensagens com:
 * - Delays humanizados via humanizer.js
 * - Fragmentação automática de mensagens longas
 * - Retry logic com backoff exponencial
 * - Rastreamento de comportamento
 */

import * as humanizer from './humanizer.js';
import * as behaviorAnalyzer from './behaviorAnalyzer.js';
import * as db from './database.js';
import { cleanBrokenFormatting } from './flowUtils.js';
import * as wahaClient from './wahaClient.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configuração de retry
const RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelay: 1000,    // 1 segundo
    maxDelay: 5000,        // 5 segundos
    backoffMultiplier: 2
};

/**
 * Envia mensagem com delay humanizado via WAHA HTTP API
 *
 * @param {string} phone - Número de telefone (JID)
 * @param {string} text - Conteúdo da mensagem
 * @param {string} complexity - Complexidade da resposta ('low'|'medium'|'high')
 * @returns {Promise<boolean>} Sucesso do envio
 */
export async function sendMessage(phone, text, complexity = 'medium') {
    if (!phone || !text) {
        console.error('❌ sendMessage: phone e text são obrigatórios');
        return false;
    }

    try {
        // Calcula delay de digitação humanizado
        const typingDelay = humanizer.calculateTypingDelay(text, complexity);
        await sleep(typingDelay);

        // Envia via WAHA com retry
        const success = await sendWithRetry(phone, text);

        if (success) {
            console.log(`✅ [${typingDelay}ms] Mensagem enviada para ${phone}`);
        } else {
            console.error(`❌ Falha ao enviar mensagem para ${phone} após ${RETRY_CONFIG.maxAttempts} tentativas`);
        }

        return success;
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${phone}:`, error.message);
        return false;
    }
}

/**
 * Envia mensagem com retry logic e backoff exponencial
 *
 * @private
 */
async function sendWithRetry(phone, text, attempt = 1) {
    try {
        const success = await wahaClient.sendMessage(phone, text);
        if (success) return true;

        // Se não sucesso e temos tentativas, retry com backoff
        if (attempt < RETRY_CONFIG.maxAttempts) {
            const delay = Math.min(
                RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
                RETRY_CONFIG.maxDelay
            );
            console.log(`⏳ Retry ${attempt}/${RETRY_CONFIG.maxAttempts - 1} em ${delay}ms...`);
            await sleep(delay);
            return sendWithRetry(phone, text, attempt + 1);
        }

        return false;
    } catch (error) {
        console.error(`❌ sendWithRetry (tentativa ${attempt}):`, error.message);
        if (attempt < RETRY_CONFIG.maxAttempts) {
            const delay = Math.min(
                RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
                RETRY_CONFIG.maxDelay
            );
            await sleep(delay);
            return sendWithRetry(phone, text, attempt + 1);
        }
        return false;
    }
}

/**
 * Envia mensagens fragmentadas com delays humanizados via WAHA HTTP API
 *
 * @param {string} phone - Número de telefone (JID)
 * @param {string[]} messages - Array de mensagens/fragmentos
 * @param {string} initialComplexity - Complexidade da primeira mensagem ('low'|'medium'|'high')
 * @param {Object} options - Opções adicionais (usuarioId para rastreamento)
 * @returns {Promise<boolean>} Sucesso do envio de todos os fragmentos
 */
export async function sendFragmentedMessages(phone, messages, initialComplexity = 'medium', options = {}) {
    if (!phone || !messages || messages.length === 0) {
        console.error('❌ sendFragmentedMessages: phone e messages (não vazio) são obrigatórios');
        return false;
    }

    // Limpa formatação quebrada e filtra mensagens vazias
    const cleanedMessages = messages
        .map(m => cleanBrokenFormatting(m))
        .filter(m => m && m.trim().length > 0);

    if (cleanedMessages.length === 0) {
        console.warn('⚠️ Nenhuma mensagem válida para enviar');
        return false;
    }

    console.log(`📨 Enviando ${cleanedMessages.length} fragmentos para ${phone}`);

    let allSuccess = true;

    for (let i = 0; i < cleanedMessages.length; i++) {
        const complexity = i === 0 ? initialComplexity : 'low';
        const success = await sendMessage(phone, cleanedMessages[i], complexity);

        if (!success) {
            allSuccess = false;
            console.error(`❌ Falha ao enviar fragmento ${i + 1}/${cleanedMessages.length}`);
        }

        // Delay humanizado entre fragmentos
        if (i < cleanedMessages.length - 1) {
            const fragmentDelay = humanizer.calculateFragmentDelay(cleanedMessages[i + 1]);
            await sleep(fragmentDelay);
        }
    }

    // Registra envio no comportamento
    behaviorAnalyzer.onBotMessageSent(phone);

    // Registra na base de dados se usuarioId fornecido
    if (options.usuarioId && cleanedMessages.length > 0) {
        try {
            db.addMensagemEnviada({
                usuarioId: options.usuarioId,
                messageKey: null,
                jid: phone,
                conteudo: cleanedMessages[cleanedMessages.length - 1]?.substring(0, 100)
            });
        } catch (e) {
            console.warn('[Sender] Erro ao registrar mensagem:', e.message);
        }
    }

    return allSuccess;
}

/**
 * Envia mensagem de texto simples (compatível com WAHA HTTP API)
 *
 * Esta é a função primária para envio via WAHA.
 * WAHA HTTP básico não suporta:
 * - Replies com quoted messages
 * - Áudio e vídeo
 * - Botões e menus interativos
 * - Presence updates
 *
 * Para esses recursos, use fragmentação de texto.
 *
 * @param {string} phone - Número de telefone (JID)
 * @param {string} text - Conteúdo de texto simples
 * @param {string} complexity - Complexidade ('low'|'medium'|'high')
 * @returns {Promise<boolean>} Sucesso do envio
 */
export async function sendTextMessage(phone, text, complexity = 'medium') {
    return sendMessage(phone, text, complexity);
}

/**
 * Fragmenta mensagem longa em múltiplos envios
 *
 * Quebra mensagens grandes automaticamente usando humanizer.fragmentMessages()
 *
 * @param {string} phone - Número de telefone (JID)
 * @param {string} text - Texto potencialmente longo
 * @param {string} initialComplexity - Complexidade ('low'|'medium'|'high')
 * @param {Object} options - Opções adicionais
 * @returns {Promise<boolean>} Sucesso do envio
 */
export async function sendLongMessage(phone, text, initialComplexity = 'medium', options = {}) {
    if (!phone || !text) {
        console.error('❌ sendLongMessage: phone e text são obrigatórios');
        return false;
    }

    // Fragmenta texto longo usando humanizer
    const fragments = humanizer.fragmentMessages(text);

    if (fragments.length === 0) {
        console.warn('⚠️ Nenhum fragmento gerado de:', text.substring(0, 50));
        return false;
    }

    // Se apenas um fragmento, envia direto
    if (fragments.length === 1) {
        return sendMessage(phone, fragments[0], initialComplexity);
    }

    // Múltiplos fragmentos: usa fragmentação humanizada
    return sendFragmentedMessages(phone, fragments, initialComplexity, options);
}

/**
 * Envia mensagem de opções em formato texto
 *
 * Simula menu de opções usando numeração, já que WAHA não suporta botões.
 *
 * @param {string} phone - Número de telefone (JID)
 * @param {string} title - Título da pergunta/menu
 * @param {string[]} options - Array de opções
 * @param {string} description - Descrição adicional (opcional)
 * @returns {Promise<boolean>} Sucesso do envio
 */
export async function sendOptionsMessage(phone, title, options, description = '') {
    if (!phone || !title || !options || options.length === 0) {
        console.error('❌ sendOptionsMessage: phone, title e options (não vazio) são obrigatórios');
        return false;
    }

    // Constrói mensagem com numeração
    let message = title;
    if (description) {
        message += '\n\n' + description;
    }

    message += '\n\n' + options
        .map((opt, i) => `${i + 1}. ${opt}`)
        .join('\n');

    console.log(`📋 Enviando menu de opções para ${phone}`);
    return sendMessage(phone, message, 'medium');
}
