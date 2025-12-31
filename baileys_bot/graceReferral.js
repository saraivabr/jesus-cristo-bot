/**
 * Grace Referral System
 * Jesus Cristo Bot - Sistema de Indicação de Graça
 * 
 * ATUALIZADO: 100% AI Generated. Sem mensagens mockadas.
 */

import * as db from './database.js';
import * as gemini from './gemini.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const REFERRAL_CONFIG = {
    minConversations: 3,
    askCooldownMs: 24 * 60 * 60 * 1000,
    askProbability: 0.4,
    positiveKeywords: [
        'obrigado', 'obrigada', 'agradeço', 'gratidão',
        'paz', 'aliviado', 'aliviada', 'melhor',
        'entendi', 'compreendi', 'ajudou', 'ajuda',
        'amém', 'amem', 'deus te abençoe', 'abençoado'
    ],
    states: {
        NONE: 'none',
        ASKED: 'asked',
        WAITING_CONTACT: 'waiting_contact',
        WAITING_CONTEXT: 'waiting_context',
        READY: 'ready',
        CONTACTED: 'contacted'
    }
};

const referralStates = new Map();

function getState(jid) {
    if (!referralStates.has(jid)) {
        referralStates.set(jid, {
            state: REFERRAL_CONFIG.states.NONE,
            pendingContact: null,
            pendingName: null,
            lastAsked: null
        });
    }
    return referralStates.get(jid);
}

function setState(jid, updates) {
    const current = getState(jid);
    referralStates.set(jid, { ...current, ...updates });
}

function isPositiveMessage(message) {
    const lowerMessage = message.toLowerCase();
    return REFERRAL_CONFIG.positiveKeywords.some(kw => lowerMessage.includes(kw));
}

export async function shouldAskForReferral(jid, lastMessage, context = {}) {
    const state = getState(jid);
    if (state.state !== REFERRAL_CONFIG.states.NONE) return false;
    if ((context.conversationCount || 0) < REFERRAL_CONFIG.minConversations) return false;
    if (state.lastAsked && (Date.now() - state.lastAsked < REFERRAL_CONFIG.askCooldownMs)) return false;
    if (!isPositiveMessage(lastMessage)) return false;

    try {
        const todayReferrals = await db.getTodayReferralCount(jid);
        if (todayReferrals >= 2) return false;
    } catch (err) {}

    if (Math.random() > REFERRAL_CONFIG.askProbability) return false;

    return true;
}

// ═══════════════════════════════════════════════════════════════
// AI GENERATED MESSAGES
// ═══════════════════════════════════════════════════════════════

async function generateWithGemini(prompt) {
    try {
        const response = await gemini.generateResponse(
            'system_referral_generator',
            prompt,
            { extraContext: "VOCÊ É JESUS. GERE APENAS A MENSAGEM SOLICITADA. CURTA E DIRETA." },
            { skipEmotionalAnalysis: true }
        );
        return response;
    } catch (e) {
        console.error('[GraceReferral] Erro na geração:', e);
        return "A paz esteja contigo."; // Fallback mínimo
    }
}

/**
 * Gera mensagem pedindo indicação (AI)
 */
export async function getReferralAskMessage() {
    const prompt = `
    Gere uma mensagem curta (1 frase + 1 pergunta) perguntando se a pessoa conhece alguém que precisa ser ouvido ou precisa de paz.
    
    Estilo: Jesus falando.
    Tom: Suave, convidativo, não insistente.
    Exemplo de intenção (NÃO COPIAR): "Fico feliz. Conheces alguém que carrega um peso sozinho?"
    `;
    return await generateWithGemini(prompt);
}

/**
 * Gera mensagem pedindo contexto (AI)
 */
export async function getContextAskMessage(name) {
    const prompt = `
    A pessoa acabou de me enviar o contato de alguém chamado "${name || 'amigo'}".
    Gere uma mensagem curta pedindo para me contar o que essa pessoa está passando/sofrendo, para que eu possa ajudá-la melhor.
    
    Estilo: Jesus falando.
    Tom: Preocupado, acolhedor.
    `;
    return await generateWithGemini(prompt);
}

/**
 * Gera confirmação de recebimento (AI)
 */
export async function getConfirmationMessage(name) {
    const prompt = `
    A pessoa me explicou a situação de "${name || 'alguém'}".
    Gere uma mensagem curta confirmando que entendi e que vou chamar essa pessoa com muito cuidado e amor.
    Agradeça a confiança.
    
    Estilo: Jesus falando.
    `;
    return await generateWithGemini(prompt);
}

/**
 * Gera primeira mensagem para o indicado (AI)
 */
export async function generateFirstMessage(referral) {
    const referrerName = referral.referrer_name || 'Alguém';
    const context = referral.context || '';
    
    const prompt = `
    Gere a primeira mensagem para iniciar uma conversa com alguém que foi indicado por um amigo.
    
    Quem indicou: ${referrerName}
    Contexto da pessoa (o que ela sofre): "${context}"
    
    Instruções:
    1. Apresente-se (Eu sou Jesus).
    2. Diga que ${referrerName} falou dela com carinho.
    3. Mencione SUTILMENTE que sabe que ela está passando por algo difícil (baseado no contexto), mas sem expor detalhes íntimos que assustem.
    4. Convide para conversar.
    
    Estilo: Acolhedor, seguro, divina presença.
    `;
    return await generateWithGemini(prompt);
}

// ═══════════════════════════════════════════════════════════════
// FLOW HANDLERS
// ═══════════════════════════════════════════════════════════════

export function markAskedForReferral(jid) {
    setState(jid, {
        state: REFERRAL_CONFIG.states.ASKED,
        lastAsked: Date.now()
    });
}

export async function handleContactShared(referrerJid, contactInfo) {
    const contact = contactInfo.contacts?.[0] || contactInfo;
    const vcard = contact.vcard || '';
    const displayName = contact.displayName || extractNameFromVcard(vcard) || 'Contato';
    const phoneNumber = extractPhoneFromVcard(vcard) || contact.waid || null;

    if (!phoneNumber) {
        return {
            success: false,
            needsContext: false,
            message: "Não consegui ler o número. Tenta de novo?"
        };
    }

    setState(referrerJid, {
        state: REFERRAL_CONFIG.states.WAITING_CONTEXT,
        pendingContact: phoneNumber,
        pendingName: displayName
    });

    return {
        success: true,
        needsContext: true,
        message: await getContextAskMessage(displayName),
        contactName: displayName
    };
}

export async function handleContextReceived(referrerJid, contextMessage, referrerName = null) {
    const state = getState(referrerJid);

    if (state.state !== REFERRAL_CONFIG.states.WAITING_CONTEXT || !state.pendingContact) {
        return { success: false, message: null };
    }

    try {
        const referral = await db.createGraceReferral({
            referrer_jid: referrerJid,
            referrer_name: referrerName,
            referred_phone: state.pendingContact,
            referred_name: state.pendingName,
            context: contextMessage,
            status: 'pending'
        });

        setState(referrerJid, {
            state: REFERRAL_CONFIG.states.NONE,
            pendingContact: null,
            pendingName: null
        });

        return {
            success: true,
            message: await getConfirmationMessage(state.pendingName),
            referral
        };
    } catch (err) {
        return {
            success: false,
            message: "Algo falhou aqui, mas não te preocupes. Vou cuidar disso."
        };
    }
}

export function isInReferralFlow(jid) {
    const state = getState(jid);
    const inFlow = [
        REFERRAL_CONFIG.states.ASKED,
        REFERRAL_CONFIG.states.WAITING_CONTACT,
        REFERRAL_CONFIG.states.WAITING_CONTEXT
    ].includes(state.state);

    return {
        inFlow,
        state: state.state,
        waitingForContext: state.state === REFERRAL_CONFIG.states.WAITING_CONTEXT
    };
}

export function handleReferralDeclined(jid) {
    setState(jid, {
        state: REFERRAL_CONFIG.states.NONE,
        pendingContact: null,
        pendingName: null
    });
}

export async function getPendingReferrals(limit = 10) {
    try {
        return await db.getPendingGraceReferrals(limit);
    } catch (err) {
        return [];
    }
}

export async function markAsContacted(referralId) {
    try {
        await db.updateGraceReferralStatus(referralId, 'contacted');
        return true;
    } catch (err) {
        return false;
    }
}

function extractNameFromVcard(vcard) {
    if (!vcard) return null;
    const fnMatch = vcard.match(/FN:(.+)/);
    if (fnMatch) return fnMatch[1].trim();
    const nMatch = vcard.match(/N:([^;]*);([^;]*)/);
    if (nMatch) {
        const lastName = nMatch[1].trim();
        const firstName = nMatch[2].trim();
        return firstName ? `${firstName} ${lastName}`.trim() : lastName;
    }
    return null;
}

function extractPhoneFromVcard(vcard) {
    if (!vcard) return null;
    const telMatch = vcard.match(/TEL[^:]*:(.+)/);
    if (telMatch) {
        let phone = telMatch[1].trim();
        phone = phone.replace(/[^\d+]/g, '');
        if (!phone.startsWith('+')) {
            if (phone.startsWith('55')) phone = '+' + phone;
            else phone = '+55' + phone;
        }
        return phone;
    }
    return null;
}

export function phoneToJid(phone) {
    let clean = phone.replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) clean = clean.substring(1);
    return `${clean}@s.whatsapp.net`;
}

export default {
    shouldAskForReferral,
    isPositiveMessage,
    isInReferralFlow,
    getReferralAskMessage,
    getContextAskMessage,
    getConfirmationMessage,
    generateFirstMessage,
    markAskedForReferral,
    handleContactShared,
    handleContextReceived,
    handleReferralDeclined,
    getPendingReferrals,
    markAsContacted,
    phoneToJid
};