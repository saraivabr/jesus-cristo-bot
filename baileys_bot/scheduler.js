import cron from 'node-cron';
import {
    getUsuario,
    addAgendamento,
    getAgendamentosPendentes,
    marcarAgendamentoEnviado
} from './database.js';

// Store active cron jobs
const cronJobs = new Map();
let sendMessageFunction = null;
let isInitialized = false;

/**
 * Initialize scheduler with message sending function
 * @param {Function} sendMessageFn - Function to send WhatsApp messages (phone, message)
 * @returns {object} Scheduler status
 */
export function initScheduler(sendMessageFn) {
    if (isInitialized) {
        console.log('[Scheduler] Already initialized');
        return { status: 'already_initialized' };
    }

    if (typeof sendMessageFn !== 'function') {
        throw new Error('sendMessageFn must be a function');
    }

    sendMessageFunction = sendMessageFn;

    // Check for pending follow-ups every 5 minutes
    const checkJob = cron.schedule('*/5 * * * *', async () => {
        console.log('[Scheduler] Checking pending follow-ups...');
        await checkPendingFollowUps();
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });

    cronJobs.set('check_followups', checkJob);
    isInitialized = true;

    console.log('[Scheduler] Initialized successfully');
    console.log('[Scheduler] Checking for pending follow-ups every 5 minutes');

    // Run initial check
    setTimeout(() => checkPendingFollowUps(), 3000);

    return {
        status: 'initialized',
        checkInterval: '5 minutes',
        timezone: 'America/Sao_Paulo'
    };
}

/**
 * Schedule a follow-up message for a user
 * @param {number} userId - User ID from database
 * @param {string} phone - User phone number
 * @param {string|Date} dateTime - When to send (ISO string or Date object)
 * @param {string} message - Custom message (optional, will generate if not provided)
 * @returns {object} Scheduled follow-up details
 */
export async function scheduleFollowUp(userId, phone, dateTime, message = null) {
    try {
        // Validate inputs
        if (!userId || !phone || !dateTime) {
            throw new Error('userId, phone, and dateTime are required');
        }

        // Convert dateTime to ISO string if it's a Date object
        const dataHora = dateTime instanceof Date
            ? dateTime.toISOString()
            : new Date(dateTime).toISOString();

        // Check if date is in the future
        const agendamentoDate = new Date(dataHora);
        const now = new Date();

        if (agendamentoDate <= now) {
            throw new Error('Follow-up date must be in the future');
        }

        // Get user profile for message generation
        const usuario = getUsuario(phone);
        if (!usuario) {
            throw new Error(`User not found: ${phone}`);
        }

        // Generate message if not provided
        const mensagem = message || generateFollowUpMessage(usuario);

        // Save to database
        const agendamento = addAgendamento({
            usuarioId: userId,
            tipo: 'followup',
            dataHora,
            mensagem
        });

        console.log(`[Scheduler] Follow-up scheduled for ${phone} at ${dataHora}`);
        console.log(`[Scheduler] Message preview: ${mensagem.substring(0, 50)}...`);

        return {
            success: true,
            agendamentoId: agendamento.id,
            phone,
            dataHora,
            message: mensagem,
            timeUntilSend: formatTimeDifference(now, agendamentoDate)
        };
    } catch (error) {
        console.error('[Scheduler] Error scheduling follow-up:', error.message);
        throw error;
    }
}

/**
 * Check for pending follow-ups and send them
 * @returns {object} Results of check operation
 */
export async function checkPendingFollowUps() {
    if (!isInitialized) {
        console.warn('[Scheduler] Not initialized, skipping check');
        return { status: 'not_initialized', sent: 0, errors: 0 };
    }

    try {
        const agendamentos = getAgendamentosPendentes();

        if (agendamentos.length === 0) {
            console.log('[Scheduler] No pending follow-ups found');
            return { status: 'no_pending', sent: 0, errors: 0 };
        }

        console.log(`[Scheduler] Found ${agendamentos.length} pending follow-up(s)`);

        let sentCount = 0;
        let errorCount = 0;
        const results = [];

        for (const agendamento of agendamentos) {
            try {
                const { id, telefone, mensagem, data_hora, nome } = agendamento;

                console.log(`[Scheduler] Sending follow-up to ${nome || telefone}...`);

                // Send message using the provided function
                await sendMessageFunction(telefone, mensagem);

                // Mark as sent in database
                marcarAgendamentoEnviado(id);

                sentCount++;
                results.push({
                    id,
                    phone: telefone,
                    status: 'sent',
                    sentAt: new Date().toISOString()
                });

                console.log(`[Scheduler] Follow-up sent successfully to ${telefone}`);

                // Small delay between messages to avoid rate limiting
                await sleep(2000);

            } catch (error) {
                errorCount++;
                results.push({
                    id: agendamento.id,
                    phone: agendamento.telefone,
                    status: 'error',
                    error: error.message
                });

                console.error(`[Scheduler] Error sending follow-up to ${agendamento.telefone}:`, error.message);
            }
        }

        console.log(`[Scheduler] Check complete: ${sentCount} sent, ${errorCount} errors`);

        return {
            status: 'complete',
            sent: sentCount,
            errors: errorCount,
            results
        };

    } catch (error) {
        console.error('[Scheduler] Error checking pending follow-ups:', error.message);
        return {
            status: 'error',
            sent: 0,
            errors: 1,
            error: error.message
        };
    }
}

/**
 * Generate personalized follow-up message based on user profile
 * @param {object} perfil - User profile from database
 * @returns {string} Personalized follow-up message
 */
export function generateFollowUpMessage(perfil) {
    const { nome, familia, trabalho, jornada_espiritual } = perfil;

    // Base greeting
    const saudacao = nome
        ? `Olá ${nome.split(' ')[0]}! 🙏`
        : 'Olá, irmão/irmã! 🙏';

    // Personalization based on profile
    const personalizations = [];

    // Family context
    if (familia?.filhos) {
        personalizations.push('Como está a família?');
    }

    // Work context
    if (trabalho?.desafios) {
        personalizations.push('Como estão as coisas no trabalho?');
    }

    // Spiritual journey context
    if (jornada_espiritual?.oracoes) {
        personalizations.push('Tem mantido suas orações em dia?');
    }

    if (jornada_espiritual?.leitura_biblica) {
        personalizations.push('Como está sua caminhada com a Palavra?');
    }

    // Build message
    const messages = [
        // Simple check-in messages
        [
            saudacao,
            'Estava pensando em você e vim saber como está.',
            personalizations.length > 0 ? personalizations[0] : 'Como tem sido sua semana?',
            '\n\nEstou aqui para conversar se precisar. 💙'
        ],
        // Encouraging messages
        [
            saudacao,
            'Deus me colocou em seu coração hoje.',
            personalizations.length > 0 ? personalizations[0] : 'Gostaria de compartilhar algo?',
            '\n\n"O Senhor é meu pastor e nada me faltará." - Salmos 23:1 🕊️'
        ],
        // Supportive messages
        [
            saudacao,
            'Espero que esteja tudo bem com você!',
            personalizations.length > 0 ? personalizations.slice(0, 2).join(' ') : 'Como posso te ajudar hoje?',
            '\n\nLembre-se: você não está sozinho nessa jornada. 🙌'
        ]
    ];

    // Select random message template
    const selectedMessage = messages[Math.floor(Math.random() * messages.length)];

    return selectedMessage.join(' ');
}

/**
 * Stop the scheduler and clear all jobs
 * @returns {object} Stop status
 */
export function stopScheduler() {
    if (!isInitialized) {
        console.log('[Scheduler] Not running, nothing to stop');
        return { status: 'not_running' };
    }

    // Stop all cron jobs
    for (const [name, job] of cronJobs.entries()) {
        job.stop();
        console.log(`[Scheduler] Stopped job: ${name}`);
    }

    cronJobs.clear();
    isInitialized = false;
    sendMessageFunction = null;

    console.log('[Scheduler] Stopped successfully');

    return { status: 'stopped' };
}

/**
 * Get scheduler status
 * @returns {object} Current scheduler status
 */
export function getSchedulerStatus() {
    return {
        initialized: isInitialized,
        activeJobs: Array.from(cronJobs.keys()),
        pendingFollowUps: getAgendamentosPendentes().length
    };
}

/**
 * Schedule a custom reminder (not just follow-ups)
 * @param {number} userId - User ID
 * @param {string} phone - Phone number
 * @param {string|Date} dateTime - When to send
 * @param {string} message - Message content
 * @param {string} tipo - Type of reminder (default: 'lembrete')
 * @returns {object} Scheduled reminder details
 */
export async function scheduleReminder(userId, phone, dateTime, message, tipo = 'lembrete') {
    try {
        const dataHora = dateTime instanceof Date
            ? dateTime.toISOString()
            : new Date(dateTime).toISOString();

        const agendamento = addAgendamento({
            usuarioId: userId,
            tipo,
            dataHora,
            mensagem: message
        });

        console.log(`[Scheduler] ${tipo} scheduled for ${phone} at ${dataHora}`);

        return {
            success: true,
            agendamentoId: agendamento.id,
            phone,
            tipo,
            dataHora,
            message
        };
    } catch (error) {
        console.error('[Scheduler] Error scheduling reminder:', error.message);
        throw error;
    }
}

// Helper functions

/**
 * Sleep utility for delays between messages
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format time difference in human-readable format
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {string} Formatted time difference
 */
function formatTimeDifference(start, end) {
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} dia(s)`;
    } else if (diffHours > 0) {
        return `${diffHours} hora(s)`;
    } else {
        return `${diffMins} minuto(s)`;
    }
}

// Export all functions
export default {
    initScheduler,
    scheduleFollowUp,
    checkPendingFollowUps,
    generateFollowUpMessage,
    stopScheduler,
    getSchedulerStatus,
    scheduleReminder
};
