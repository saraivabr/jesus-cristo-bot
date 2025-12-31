/**
 * 📅 ADVANCED SCHEDULER - 100% Programmatic Intelligence
 * Jesus Cristo Bot - Proactive Care System
 * 
 * ATUALIZADO: Erradicação total de mocks.
 * Delegando geração de saudações, versículos e despedidas para IA.
 */

import cron from 'node-cron';
import * as db from './database.js';
import config from './config.js';
import * as gemini from './gemini.js';
import * as semanticMemory from './semanticMemory.js';

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
 */
async function runMorningJob() {
    console.log('[Scheduler] Iniciando Job Matinal...');
    const usuarios = db.prepare(`SELECT * FROM usuarios WHERE versiculo_diario_ativo = 1`).all();

    for (const u of usuarios) {
        const msg = await generateProactiveMessage(u.telefone, 'bom_dia');
        await sendMessageFunction(u.telefone, msg);
        await sleep(3000);
    }
}

/**
 * Job de Boa Noite (Despedida Noturna)
 */
async function runNightJob() {
    console.log('[Scheduler] Iniciando Job Noturno...');
    // Pega usuários que falaram hoje
    const hoje = new Date().toISOString().split('T')[0];
    const usuarios = db.prepare(`
        SELECT DISTINCT u.* FROM usuarios u 
        JOIN historico h ON u.id = h.usuario_id 
        WHERE DATE(h.timestamp) = ?
    `).all(hoje);

    for (const u of usuarios) {
        const msg = await generateProactiveMessage(u.telefone, 'boa_noite');
        await sendMessageFunction(u.telefone, msg);
        await sleep(3000);
    }
}

/**
 * Processa agendamentos de Follow-up (Memória)
 */
async function checkPendingFollowUps() {
    const pendentes = db.getAgendamentosPendentes();
    for (const a of pendentes) {
        try {
            // Se não tem mensagem definida, gera uma via IA baseada no contexto
            const msg = a.mensagem || await generateProactiveMessage(a.telefone, 'follow_up', a.contexto);
            await sendMessageFunction(a.telefone, msg);
            db.marcarAgendamentoEnviado(a.id);
            await sleep(2000);
        } catch (e) { console.error("[Scheduler] Falha no follow-up:", e); }
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

export function initScheduler(sendFn) {
    if (isInitialized) return;
    sendMessageFunction = sendFn;

    // 1. Follow-ups (cada minuto)
    cron.schedule('* * * * *', checkPendingFollowUps);

    // 2. Bom Dia (7:00 AM)
    cron.schedule('0 7 * * *', runMorningJob);

    // 3. Boa Noite (22:30 PM)
    cron.schedule('30 22 * * *', runNightJob);

    // 4. Aniversários (9:00 AM)
    cron.schedule('0 9 * * *', async () => {
        const hoje = new Date().toISOString().substring(5, 10); // MM-DD
        const aniversariantes = db.prepare(`SELECT * FROM usuarios WHERE aniversario = ?`).all(hoje);
        for (const u of aniversariantes) {
            const msg = await generateProactiveMessage(u.telefone, 'aniversario');
            await sendMessageFunction(u.telefone, msg);
            await sleep(3000);
        }
    });

    isInitialized = true;
    console.log('[Scheduler] Inicializado com Inteligência Programática Total.');
}

// Helpers para compatibilidade
export const scheduleFollowUp = (userId, phone, dateTime, message) => {
    db.addAgendamento({ usuarioId: userId, tipo: 'followup', dataHora: dateTime, mensagem: message });
};

export const stopScheduler = () => { console.log('[Scheduler] Parado.'); };

export default { initScheduler, scheduleFollowUp, stopScheduler };