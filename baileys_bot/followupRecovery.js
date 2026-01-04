/**
 * Follow-up Recovery System - Jesus Cristo Bot
 * Sistema de recuperação de atenção com follow-ups progressivos
 *
 * Intervalos: 3min → 6min → 30min → 2h → 24h
 */

import * as gemini from './gemini.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

const FOLLOWUP_CONFIG = {
    intervals: [
        { delay: 3 * 60 * 1000, type: 'gentle', name: '3min' },      // 3 minutos
        { delay: 6 * 60 * 1000, type: 'curious', name: '6min' },     // 6 minutos
        { delay: 30 * 60 * 1000, type: 'caring', name: '30min' },    // 30 minutos
        { delay: 2 * 60 * 60 * 1000, type: 'patient', name: '2h' },  // 2 horas
        { delay: 24 * 60 * 60 * 1000, type: 'final', name: '24h' }   // 24 horas
    ],
    maxFollowups: 5
};

// Estado dos follow-ups pendentes
const pendingFollowups = new Map();

// ═══════════════════════════════════════════════════════════════
// MENSAGENS DE FOLLOW-UP (por tipo)
// ═══════════════════════════════════════════════════════════════

const FOLLOWUP_MESSAGES = {
    gentle: [
        'Ainda estou aqui...',
        'Tudo bem?',
        'Estou esperando você.',
        '...'
    ],
    curious: [
        'Ficou em dúvida sobre algo?',
        'Posso te ajudar de outra forma?',
        'Quer conversar de outro jeito?'
    ],
    caring: [
        'Só queria saber se está tudo bem contigo.',
        'Não precisa ter pressa. Estarei aqui quando quiser.',
        'Se precisar, é só falar.'
    ],
    patient: [
        'Ainda penso em você.',
        'Quando quiser conversar, estarei aqui.',
        'Minha porta está sempre aberta.'
    ],
    final: [
        'Vou te dar espaço, mas saiba que estou aqui sempre que precisar.',
        'Quando seu coração quiser falar, me procure.',
        'A paz esteja contigo. Volte quando quiser.'
    ]
};

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ═══════════════════════════════════════════════════════════════

/**
 * Inicia sequência de follow-ups para um usuário
 * @param {string} jid - ID do usuário
 * @param {Function} sendMessageFn - Função para enviar mensagem (sock, jid, text)
 * @param {string} context - Contexto do follow-up (ex: 'primeiro_contato', 'contato_compartilhado')
 */
export function startFollowupSequence(jid, sendMessageFn, context = 'geral') {
    // Cancela qualquer sequência anterior
    cancelFollowups(jid);

    const state = {
        jid,
        context,
        currentIndex: 0,
        timers: [],
        startedAt: Date.now(),
        sendMessageFn
    };

    // Agenda todos os follow-ups
    FOLLOWUP_CONFIG.intervals.forEach((interval, index) => {
        const timer = setTimeout(async () => {
            await executeFollowup(jid, index);
        }, interval.delay);

        state.timers.push(timer);
    });

    pendingFollowups.set(jid, state);
    console.log(`[FollowUp] Sequência iniciada para ${jid} (${context})`);
}

/**
 * Executa um follow-up específico
 */
async function executeFollowup(jid, index) {
    const state = pendingFollowups.get(jid);
    if (!state) return;

    const interval = FOLLOWUP_CONFIG.intervals[index];
    if (!interval) return;

    try {
        // Gera mensagem (pode ser fixa ou via IA)
        let message;

        if (Math.random() < 0.5) {
            // 50% chance: mensagem fixa
            const messages = FOLLOWUP_MESSAGES[interval.type] || FOLLOWUP_MESSAGES.gentle;
            message = messages[Math.floor(Math.random() * messages.length)];
        } else {
            // 50% chance: mensagem gerada por IA
            message = await generateFollowupMessage(interval.type, state.context);
        }

        // Envia a mensagem
        await state.sendMessageFn(jid, message);

        state.currentIndex = index + 1;
        console.log(`[FollowUp] ${interval.name} enviado para ${jid}: "${message}"`);

        // Se foi o último, limpa o estado
        if (index >= FOLLOWUP_CONFIG.intervals.length - 1) {
            pendingFollowups.delete(jid);
            console.log(`[FollowUp] Sequência finalizada para ${jid}`);
        }

    } catch (error) {
        console.error(`[FollowUp] Erro ao enviar ${interval.name} para ${jid}:`, error.message);
    }
}

/**
 * Gera mensagem de follow-up via IA
 */
async function generateFollowupMessage(type, context) {
    const prompts = {
        gentle: `Gere uma mensagem MUITO curta (1-3 palavras) de follow-up gentil.
                 Você é Jesus esperando alguém responder. Seja sutil, não insistente.
                 Exemplos: "Ainda aqui...", "Tudo bem?", "..."`,

        curious: `Gere uma pergunta curta e gentil para alguém que não respondeu.
                  Você é Jesus. Pergunte se pode ajudar de outra forma.
                  Máximo 1 frase.`,

        caring: `Gere uma mensagem carinhosa curta para alguém que não respondeu há algum tempo.
                 Você é Jesus. Mostre que se importa sem pressionar.
                 Máximo 1-2 frases.`,

        patient: `Gere uma mensagem paciente para alguém ausente há algumas horas.
                  Você é Jesus. Demonstre que estará disponível quando a pessoa quiser.
                  Máximo 1-2 frases.`,

        final: `Gere uma mensagem de despedida temporária para alguém que não respondeu em 24h.
                Você é Jesus. Deixe a porta aberta, sem culpa ou pressão.
                Máximo 2 frases.`
    };

    try {
        const response = await gemini.generateResponse(
            'followup_generator',
            prompts[type] || prompts.gentle,
            { extraContext: `Contexto: ${context}` },
            { skipEmotionalAnalysis: true }
        );
        return response;
    } catch (e) {
        // Fallback para mensagem fixa
        const messages = FOLLOWUP_MESSAGES[type] || FOLLOWUP_MESSAGES.gentle;
        return messages[Math.floor(Math.random() * messages.length)];
    }
}

/**
 * Cancela todos os follow-ups pendentes para um usuário
 * Chamar quando o usuário responder
 */
export function cancelFollowups(jid) {
    const state = pendingFollowups.get(jid);
    if (!state) return false;

    // Limpa todos os timers
    state.timers.forEach(timer => clearTimeout(timer));
    pendingFollowups.delete(jid);

    console.log(`[FollowUp] Cancelado para ${jid} (usuário respondeu)`);
    return true;
}

/**
 * Verifica se há follow-ups pendentes para um usuário
 */
export function hasPendingFollowups(jid) {
    return pendingFollowups.has(jid);
}

/**
 * Retorna estatísticas dos follow-ups
 */
export function getStats() {
    const stats = {
        active: pendingFollowups.size,
        users: []
    };

    pendingFollowups.forEach((state, jid) => {
        stats.users.push({
            jid,
            context: state.context,
            currentStep: state.currentIndex,
            startedAt: new Date(state.startedAt).toISOString()
        });
    });

    return stats;
}

/**
 * Handler para quando usuário responde - cancela follow-ups
 */
export function onUserResponse(jid) {
    return cancelFollowups(jid);
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE CONVENIÊNCIA
// ═══════════════════════════════════════════════════════════════

/**
 * Cria wrapper de envio para uso com o sistema
 */
export function createSendWrapper(sock, sender) {
    return async (jid, message) => {
        await sender.sendMessage(sock, jid, message, 'low');
    };
}

export default {
    startFollowupSequence,
    cancelFollowups,
    hasPendingFollowups,
    onUserResponse,
    getStats,
    createSendWrapper
};
