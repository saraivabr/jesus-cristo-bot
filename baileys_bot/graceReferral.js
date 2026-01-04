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

// ═══════════════════════════════════════════════════════════════
// ENHANCED FEATURES - Mensagens Personalizadas e Conversões
// ═══════════════════════════════════════════════════════════════

// Contextos de sofrimento para personalização
const CONTEXTOS_SOFRIMENTO = {
    luto: ['morreu', 'morte', 'faleceu', 'perdeu', 'luto', 'saudade', 'partiu', 'céu'],
    saude: ['doença', 'doente', 'hospital', 'câncer', 'tratamento', 'cirurgia', 'diagnóstico'],
    relacionamento: ['separou', 'divórcio', 'traição', 'término', 'brigou', 'casamento', 'namoro'],
    financeiro: ['dívida', 'desemprego', 'demitido', 'faliu', 'dinheiro', 'conta', 'desespero'],
    depressao: ['depressão', 'ansiedade', 'triste', 'sozinho', 'vazio', 'sem sentido', 'desanimado'],
    familia: ['filho', 'pai', 'mãe', 'irmão', 'família', 'conflito', 'briga familiar'],
    fe: ['dúvida', 'fé', 'distante de deus', 'não acredita', 'raiva de deus', 'abandonado']
};

/**
 * Detecta o tipo de contexto do sofrimento
 * @param {string} contexto - Descrição da situação
 * @returns {string} Tipo de contexto detectado
 */
function detectarTipoContexto(contexto) {
    if (!contexto) return 'geral';
    const textoLower = contexto.toLowerCase();

    for (const [tipo, keywords] of Object.entries(CONTEXTOS_SOFRIMENTO)) {
        if (keywords.some(kw => textoLower.includes(kw))) {
            return tipo;
        }
    }
    return 'geral';
}

/**
 * Gera mensagem personalizada baseada no contexto específico
 * @param {object} referral - Dados da indicação
 * @returns {string} Mensagem personalizada
 */
export async function gerarMensagemPersonalizada(referral) {
    const referrerName = referral.referrer_name || 'Alguém que te ama';
    const referredName = referral.referred_name || 'filho(a)';
    const contexto = referral.context || '';
    const tipoContexto = detectarTipoContexto(contexto);

    const promptsByContexto = {
        luto: `
        Gere uma primeira mensagem para alguém que está passando por LUTO (perda de alguém querido).
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Seja extremamente sensível e acolhedor
        2. Não minimize a dor - valide o sofrimento
        3. Mencione que ${referrerName} se preocupa
        4. Ofereça presença, não soluções
        5. Use versículos sobre consolo (Salmo 23, Mateus 5:4)
        `,

        saude: `
        Gere uma primeira mensagem para alguém enfrentando PROBLEMAS DE SAÚDE.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Transmita esperança sem ser superficial
        2. Reconheça o peso da situação
        3. Ofereça presença constante
        4. Use versículos sobre cura e força (Isaías 41:10, Êxodo 15:26)
        `,

        relacionamento: `
        Gere uma primeira mensagem para alguém com DOR DE RELACIONAMENTO (separação, traição).
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Não julgue nem tome lados
        2. Valide a dor do coração partido
        3. Ofereça escuta sem pressa
        4. Foque na cura interior, não no relacionamento
        `,

        financeiro: `
        Gere uma primeira mensagem para alguém em CRISE FINANCEIRA.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Não pregue - acolha primeiro
        2. Reconheça o estresse e a pressão
        3. Transmita que Deus é provedor sem clichês
        4. Ofereça paz antes de soluções
        `,

        depressao: `
        Gere uma primeira mensagem para alguém com DEPRESSÃO/ANSIEDADE.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. EXTREMAMENTE cuidadoso e gentil
        2. Não diga "tenha fé" ou "não fique triste"
        3. Valide os sentimentos como reais
        4. Ofereça presença constante e paciente
        5. Mencione que está disponível a qualquer hora
        `,

        familia: `
        Gere uma primeira mensagem para alguém com CONFLITOS FAMILIARES.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Seja neutro - não tome partido
        2. Reconheça que família dói quando machuca
        3. Ofereça um espaço seguro para desabafar
        4. Fale sobre paz e reconciliação com sabedoria
        `,

        fe: `
        Gere uma primeira mensagem para alguém com CRISE DE FÉ.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Detalhes: "${contexto}"

        Instruções:
        1. Não julgue as dúvidas
        2. Acolha questionamentos como válidos
        3. Mostre que duvidar não é pecado
        4. Ofereça conversa sem pressão por respostas
        `,

        geral: `
        Gere uma primeira mensagem para alguém que está passando por dificuldades.
        Quem indicou: ${referrerName}
        Nome da pessoa: ${referredName}
        Contexto: "${contexto}"

        Instruções:
        1. Seja acolhedor e aberto
        2. Não presuma saber tudo - convide a conversar
        3. Transmita paz e disponibilidade
        `
    };

    const prompt = promptsByContexto[tipoContexto] + `

    Tom geral: Jesus falando com amor infinito.
    Formato: Máximo 3 parágrafos curtos.
    IMPORTANTE: Não exponha detalhes íntimos que assustem a pessoa.
    `;

    return await generateWithGemini(prompt);
}

/**
 * Rastreia conversão e notifica quem indicou
 * @param {string} referredJid - JID da pessoa indicada que se converteu/engajou
 * @param {function} sendMessage - Função para enviar mensagem
 * @returns {object} Resultado do rastreamento
 */
export async function rastrearConversao(referredJid, sendMessage = null) {
    try {
        // Busca referral pelo número do indicado
        const referral = await db.getReferralByReferred(referredJid);

        if (!referral) {
            return { success: false, reason: 'no_referral_found' };
        }

        // Atualiza status para converted
        await db.updateGraceReferralStatus(referral.id, 'converted');

        // Se temos função de envio e JID do referrer, notifica
        if (sendMessage && referral.referrer_jid) {
            const nomeIndicado = referral.referred_name || 'A pessoa';

            const mensagemNotificacao = await generateWithGemini(`
                Gere uma mensagem curta para notificar alguém que a pessoa que ele indicou (${nomeIndicado}) está se abrindo e se conectando com Deus.

                Instruções:
                1. Celebre com alegria genuína
                2. Agradeça por ter feito a indicação
                3. Diga que ${nomeIndicado} está no caminho certo
                4. Mencione que os anjos se alegram (Lucas 15:10)
                5. Máximo 2 parágrafos

                Tom: Celebração e gratidão
            `);

            try {
                await sendMessage(referral.referrer_jid, mensagemNotificacao);
            } catch (e) {
                console.error('[GraceReferral] Erro ao notificar referrer:', e);
            }
        }

        return {
            success: true,
            referral,
            message: 'Conversão rastreada com sucesso'
        };

    } catch (err) {
        console.error('[GraceReferral] Erro ao rastrear conversão:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Verifica se uma pessoa foi indicada e retorna contexto
 * @param {string} jid - JID da pessoa
 * @returns {object|null} Dados da indicação ou null
 */
export async function getContextoIndicacao(jid) {
    try {
        const referral = await db.getReferralByReferred(jid);
        if (!referral) return null;

        return {
            foiIndicado: true,
            referrerName: referral.referrer_name,
            contexto: referral.context,
            tipoContexto: detectarTipoContexto(referral.context),
            dataIndicacao: referral.created_at
        };
    } catch (err) {
        return null;
    }
}

/**
 * Obtém estatísticas de indicações
 * @param {string} referrerJid - JID do indicador (opcional)
 * @returns {object} Estatísticas
 */
export async function getEstatisticasIndicacao(referrerJid = null) {
    try {
        return await db.getReferralStats(referrerJid);
    } catch (err) {
        return {
            total: 0,
            pending: 0,
            contacted: 0,
            converted: 0
        };
    }
}

export default {
    shouldAskForReferral,
    isPositiveMessage,
    isInReferralFlow,
    getReferralAskMessage,
    getContextAskMessage,
    getConfirmationMessage,
    generateFirstMessage,
    gerarMensagemPersonalizada,
    rastrearConversao,
    getContextoIndicacao,
    getEstatisticasIndicacao,
    markAskedForReferral,
    handleContactShared,
    handleContextReceived,
    handleReferralDeclined,
    getPendingReferrals,
    markAsContacted,
    phoneToJid
};