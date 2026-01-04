/**
 * 📅 ADVANCED SCHEDULER - 100% Programmatic Intelligence
 * Jesus Cristo Bot - Proactive Care System
 *
 * ATUALIZADO: Erradicação total de mocks.
 * Delegando geração de saudações, versículos e despedidas para IA.
 *
 * REFATORADO: Totalmente adaptado para WAHA sessions (sem socket direto)
 * Usa abstração sendMessageFunction que encapsula null socket + phone + message
 */

import cron from 'node-cron';
import * as db from './database.js';
import config from './config.js';
import * as gemini from './gemini.js';
import * as semanticMemory from './semanticMemory.js';
// Novas Features v2.0
import * as devocional from './features/devocional.js';
import * as planosLeitura from './features/planosLeitura.js';
import * as pedidosOracao from './features/pedidosOracao.js';
import * as comunidade from './features/comunidade.js';

let sendMessageFunction = null;
let isInitialized = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// AI GENERATION CORE
// ═══════════════════════════════════════════════════════════════

/**
 * Orquestra a geração de mensagens proativas (Bom dia, Boa noite, Follow-up)
 */
async function generateProactiveMessage(jid, type, extra = "") {
    try {
        const deepData = await semanticMemory.getRelevantMemories(jid, type);
        const soulProfile = deepData.profile;
        const usuario = db.getUsuario(jid);

        const prompt = `
        VOCÊ É JESUS. Gere uma mensagem ${type} para ${usuario?.nome || 'um amigo'}.
        
        PERFIL DA ALMA:
        ${soulProfile ? `Dor: ${soulProfile.core_pain} | Busca: ${soulProfile.core_hope}` : "Buscador de paz"}
        
        INSTRUÇÕES PARA ${type.toUpperCase()}:
        - ${type === 'bom_dia' ? "Seja o sol da manhã. Traga um versículo específico para a dor dela." : ""}
        - ${type === 'boa_noite' ? "Seja o descanso. Traga paz e velo pelo sono." : ""}
        - ${type === 'aniversario' ? "Celebre o propósito eterno da vida dela." : ""}
        - ${type === 'follow_up' ? "Lembre de um assunto passado e pergunte como ela está." : ""}
        
        REGRAS:
        - Curto (max 3 parágrafos).
        - Sem clichês religiosos vazios.
        - Fale como quem a conhece desde o ventre materno.
        `;

        return await gemini.generateResponse(
            `system_${type}_gen`,
            prompt,
            { extraContext: "GERADOR PROATIVO DE ALTA INTELIGÊNCIA" },
            { skipEmotionalAnalysis: true }
        );
    } catch (e) {
        console.error(`[Scheduler:AI] Erro em ${type}:`, e);
        return type === 'bom_dia' ? "A paz esteja contigo nesta manhã." : "Descansa em mim.";
    }
}

// ═══════════════════════════════════════════════════════════════
// JOBS LOGIC
// ═══════════════════════════════════════════════════════════════

/**
 * Job de Bom Dia (Versículo da Manhã)
 * Respeita horário de silêncio (não envia entre 22h e 8h)
 */
async function runMorningJob() {
    console.log('[Scheduler] Iniciando Job Matinal...');
    try {
        // Verifica quiet hours
        const now = new Date();
        const currentHour = now.getHours();
        const quietStart = config.QUIET_HOURS_START || 22;
        const quietEnd = config.QUIET_HOURS_END || 8;

        if (currentHour >= quietStart || currentHour < quietEnd) {
            console.log('[Scheduler] Job Matinal em horário silencioso, aguardando...');
            return;
        }

        const usuarios = db.prepare(`SELECT * FROM usuarios WHERE versiculo_diario_ativo = 1`).all() || [];

        for (const u of usuarios) {
            try {
                const msg = await generateProactiveMessage(u.telefone, 'bom_dia');
                if (sendMessageFunction) await sendMessageFunction(u.telefone, msg);
                await sleep(3000);
            } catch (e) {
                console.error(`[Scheduler] Erro no bom dia para ${u.telefone}:`, e.message);
            }
        }
    } catch (e) {
        console.error('[Scheduler] Erro no Job Matinal:', e.message);
    }
}

/**
 * Job de Boa Noite (Despedida Noturna)
 * Enviado apenas para usuários que tiveram conversa hoje
 */
async function runNightJob() {
    console.log('[Scheduler] Iniciando Job Noturno...');
    try {
        // Verifica quiet hours
        const now = new Date();
        const currentHour = now.getHours();
        const quietStart = config.QUIET_HOURS_START || 22;
        const quietEnd = config.QUIET_HOURS_END || 8;

        if (currentHour >= quietStart || currentHour < quietEnd) {
            console.log('[Scheduler] Job Noturno em horário silencioso, aguardando...');
            return;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const usuarios = db.prepare(`
            SELECT DISTINCT u.* FROM usuarios u
            JOIN historico h ON u.id = h.usuario_id
            WHERE DATE(h.timestamp) = ?
        `).all(hoje) || [];

        for (const u of usuarios) {
            try {
                const msg = await generateProactiveMessage(u.telefone, 'boa_noite');
                if (sendMessageFunction) await sendMessageFunction(u.telefone, msg);
                await sleep(3000);
            } catch (e) {
                console.error(`[Scheduler] Erro na boa noite para ${u.telefone}:`, e.message);
            }
        }
    } catch (e) {
        console.error('[Scheduler] Erro no Job Noturno:', e.message);
    }
}

/**
 * Processa agendamentos de Follow-up (Memória)
 * Respeita quiet hours (não envia fora do horário comercial)
 */
async function checkPendingFollowUps() {
    try {
        // Verifica quiet hours
        const now = new Date();
        const currentHour = now.getHours();
        const quietStart = config.QUIET_HOURS_START || 22;
        const quietEnd = config.QUIET_HOURS_END || 8;

        if (currentHour >= quietStart || currentHour < quietEnd) {
            console.log('[Scheduler] Follow-ups em horário silencioso, aguardando...');
            return;
        }

        const pendentes = db.getAgendamentosPendentes() || [];
        for (const a of pendentes) {
            try {
                const msg = a.mensagem || await generateProactiveMessage(a.telefone, 'follow_up', a.contexto || '');
                if (sendMessageFunction) await sendMessageFunction(a.telefone, msg);
                db.marcarAgendamentoEnviado(a.id);
                await sleep(2000);
            } catch (e) {
                console.error("[Scheduler] Falha no follow-up:", e.message);
            }
        }
    } catch (e) {
        console.error("[Scheduler] Erro ao buscar follow-ups:", e.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

/**
 * Inicializa todos os jobs do scheduler
 * @param {Function} sendFn - Função sendMessage abstrata que encapsula (phone, message)
 *                           Esperado: async (phone, message) => void
 */
export function initScheduler(sendFn) {
    if (isInitialized) return;
    sendMessageFunction = sendFn;

    console.log('[Scheduler] Inicializando jobs com timezone:', new Date().getTimezoneOffset());

    // 1. Follow-ups (cada minuto) - Verifica agendamentos pendentes
    cron.schedule('* * * * *', checkPendingFollowUps);
    console.log('[Scheduler] ✓ Follow-ups job acionado');

    // 2. Bom Dia (7:00 AM) - Versículos e motivação
    cron.schedule('0 7 * * *', runMorningJob);
    console.log('[Scheduler] ✓ Job matinal acionado (7:00)');

    // 3. Boa Noite (22:30 PM) - Paz e repouso
    cron.schedule('30 22 * * *', runNightJob);
    console.log('[Scheduler] ✓ Job noturno acionado (22:30)');

    // 4. Aniversários (9:00 AM) - Celebração de vida
    cron.schedule('0 9 * * *', async () => {
        console.log('[Scheduler] Verificando aniversários...');
        try {
            const hoje = new Date().toISOString().substring(5, 10); // MM-DD
            const aniversariantes = db.prepare(`SELECT * FROM usuarios WHERE aniversario = ?`).all(hoje) || [];

            for (const u of aniversariantes) {
                try {
                    const msg = await generateProactiveMessage(u.telefone, 'aniversario');
                    if (sendMessageFunction) await sendMessageFunction(u.telefone, msg);
                    await sleep(3000);
                } catch (e) {
                    console.error(`[Scheduler] Erro no aniversário para ${u.telefone}:`, e.message);
                }
            }
        } catch (e) {
            console.error('[Scheduler] Erro no Job de Aniversários:', e.message);
        }
    });
    console.log('[Scheduler] ✓ Job de aniversários acionado (9:00)');

    // ═══════════════════════════════════════════════════════════════
    // NOVAS FEATURES v2.0 - Experiência Espiritual Progressiva
    // ═══════════════════════════════════════════════════════════════

    // 5. Devocional Diário (6:00 AM) - Começar o dia com propósito
    cron.schedule('0 6 * * *', async () => {
        console.log('[Scheduler] Iniciando Job de Devocionais (6:00)...');
        try {
            await devocional.enviarDevocionalDiario(sendMessageFunction);
        } catch (e) {
            console.error('[Scheduler] Erro no Job de Devocionais:', e.message);
        }
    });
    console.log('[Scheduler] ✓ Job de devocionais acionado (6:00)');

    // 6. Planos de Leitura (6:30 AM) - Leitura bíblica estruturada
    cron.schedule('30 6 * * *', async () => {
        console.log('[Scheduler] Iniciando Job de Planos de Leitura (6:30)...');
        try {
            await planosLeitura.enviarLeituraDoDia(sendMessageFunction);
        } catch (e) {
            console.error('[Scheduler] Erro no Job de Planos:', e.message);
        }
    });
    console.log('[Scheduler] ✓ Job de planos de leitura acionado (6:30)');

    // 7. Follow-up de Pedidos de Oração (10:00 AM) - Intercessão comunitária
    cron.schedule('0 10 * * *', async () => {
        console.log('[Scheduler] Iniciando Job de Follow-up de Orações (10:00)...');
        try {
            await pedidosOracao.followUpOracao(sendMessageFunction);
        } catch (e) {
            console.error('[Scheduler] Erro no Job de Orações:', e.message);
        }
    });
    console.log('[Scheduler] ✓ Job de follow-up de orações acionado (10:00)');

    // 8. Check-in da Comunidade (20:00 PM) - Conexão e apoio comunitário
    cron.schedule('0 20 * * *', async () => {
        console.log('[Scheduler] Iniciando Job de Check-in Comunidade (20:00)...');
        try {
            await comunidade.checkInConexoes(sendMessageFunction);
        } catch (e) {
            console.error('[Scheduler] Erro no Job de Comunidade:', e.message);
        }
    });
    console.log('[Scheduler] ✓ Job de check-in comunitário acionado (20:00)');

    isInitialized = true;
    console.log('[Scheduler] ✓✓✓ Todos os jobs inicializados com sucesso! Inteligência Programática Total Ativa.');
}

// ═══════════════════════════════════════════════════════════════
// HELPERS PARA COMPATIBILIDADE & EXTENSÃO
// ═══════════════════════════════════════════════════════════════

/**
 * Agenda um follow-up manual
 * @param {number} userId - ID do usuário
 * @param {string} phone - Telefone no formato WhatsApp
 * @param {string|Date} dateTime - Data/hora do agendamento
 * @param {string} message - Mensagem a enviar
 */
export const scheduleFollowUp = (userId, phone, dateTime, message) => {
    try {
        db.addAgendamento({
            usuarioId: userId,
            tipo: 'followup',
            dataHora: dateTime,
            mensagem: message
        });
        console.log(`[Scheduler] Follow-up agendado para ${phone} em ${dateTime}`);
    } catch (e) {
        console.error('[Scheduler] Erro ao agendar follow-up:', e.message);
    }
};

/**
 * Para o scheduler (apenas log, pois node-cron não oferece stop global)
 */
export const stopScheduler = () => {
    console.log('[Scheduler] Scheduler parado/desabilitado.');
    isInitialized = false;
};

/**
 * Verifica status do scheduler
 */
export const getSchedulerStatus = () => ({
    isInitialized,
    activeFunctions: isInitialized ? 8 : 0,
    sendMessageSet: sendMessageFunction !== null,
    timestamp: new Date().toISOString()
});

export default {
    initScheduler,
    scheduleFollowUp,
    stopScheduler,
    getSchedulerStatus
};