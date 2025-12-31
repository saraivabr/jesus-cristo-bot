/**
 * 🧠 BEHAVIOR ANALYZER - Análise Psicodinâmica via Baileys
 *
 * Usa recursos inexplorados do Baileys para criar perfis comportamentais
 * que adaptam automaticamente as respostas do bot de forma INVISÍVEL.
 *
 * Recursos analisados:
 * - presence.update: composing, recording, available, unavailable, paused
 * - messages.update: edições, deleções
 * - Timestamps: tempo entre mensagens
 * - Padrões: horários, frequência, tamanho
 */

// ═══════════════════════════════════════════════════════════════
// ESTRUTURAS DE DADOS
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} TypingPattern
 * @property {number} startedAt - Quando começou a digitar
 * @property {number} pausedAt - Quando pausou (pode ser 0)
 * @property {number} sentAt - Quando enviou (pode ser 0)
 * @property {number} cycles - Quantas vezes parou e voltou a digitar
 * @property {number} totalDuration - Duração total da digitação
 */

/**
 * @typedef {Object} PresenceData
 * @property {TypingPattern[]} typingPatterns - Histórico de padrões de digitação
 * @property {number} onlineWithoutResponse - Vezes online sem responder
 * @property {number} avgResponseTime - Média de tempo para responder (ms)
 * @property {number[]} responseTimes - Histórico de tempos de resposta
 * @property {number} lastSeen - Último timestamp visto
 * @property {string} currentStatus - Status atual (composing, available, etc)
 */

/**
 * @typedef {Object} MessagingData
 * @property {number} deletedMessages - Total de mensagens deletadas
 * @property {number} editedMessages - Total de mensagens editadas
 * @property {number[]} messageLengths - Histórico de tamanhos de mensagens
 * @property {number} avgMessageLength - Média de tamanho de mensagens
 * @property {number} burstMessages - Mensagens em rajada (sequência rápida)
 * @property {number} audioCount - Quantidade de áudios enviados
 * @property {number} textCount - Quantidade de textos enviados
 * @property {number[]} messageTimestamps - Timestamps das mensagens
 */

/**
 * @typedef {Object} TemporalData
 * @property {Map<number, number>} hourActivity - Atividade por hora (0-23)
 * @property {Map<number, number>} dayActivity - Atividade por dia (0-6)
 * @property {boolean} nightOwl - Se é ativo de madrugada
 * @property {boolean} weekendOnly - Se só conversa nos fins de semana
 * @property {number[]} sessionDurations - Durações das sessões de conversa
 */

/**
 * @typedef {Object} BehaviorTraits
 * @property {number} ansiedade - Score 0-10
 * @property {number} evitacao - Score 0-10
 * @property {number} impulsividade - Score 0-10
 * @property {number} perfeccionismo - Score 0-10
 * @property {number} profundidade - Score 0-10
 * @property {number} vulnerabilidade - Score 0-10
 * @property {number} engajamento - Score 0-10
 */

/**
 * @typedef {Object} BehaviorProfile
 * @property {string} type - Tipo dominante: ansioso, evitativo, impulsivo, perfeccionista, reflexivo, em_crise
 * @property {number} confidence - Confiança na análise (0-1)
 * @property {BehaviorTraits} traits - Scores de cada trait
 * @property {number} lastUpdated - Timestamp da última atualização
 */

/**
 * @typedef {Object} UserBehavior
 * @property {string} jid - ID do usuário
 * @property {PresenceData} presence - Dados de presença
 * @property {MessagingData} messaging - Dados de mensagens
 * @property {TemporalData} temporal - Dados temporais
 * @property {BehaviorProfile} profile - Perfil calculado
 * @property {number} firstSeen - Primeiro contato
 * @property {number} lastActivity - Última atividade
 */

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════

/** @type {Map<string, UserBehavior>} */
const userBehaviors = new Map();

/** @type {Map<string, {status: string, startedAt: number, cycles: number}>} */
const activeTyping = new Map();

/** @type {Map<string, number>} */
const lastMessageSentByBot = new Map();

/** @type {Map<string, Promise<void>>} */
const typingWaiters = new Map();

// ═══════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

/**
 * Inicializa ou recupera dados de comportamento de um usuário
 * @param {string} jid
 * @returns {UserBehavior}
 */
function getOrCreateBehavior(jid) {
    if (!userBehaviors.has(jid)) {
        const now = Date.now();
        userBehaviors.set(jid, {
            jid,
            presence: {
                typingPatterns: [],
                onlineWithoutResponse: 0,
                avgResponseTime: 0,
                responseTimes: [],
                lastSeen: now,
                currentStatus: 'unknown'
            },
            messaging: {
                deletedMessages: 0,
                editedMessages: 0,
                messageLengths: [],
                avgMessageLength: 0,
                burstMessages: 0,
                audioCount: 0,
                textCount: 0,
                messageTimestamps: []
            },
            temporal: {
                hourActivity: new Map(),
                dayActivity: new Map(),
                nightOwl: false,
                weekendOnly: false,
                sessionDurations: []
            },
            profile: {
                type: 'desconhecido',
                confidence: 0,
                traits: {
                    ansiedade: 5,
                    evitacao: 5,
                    impulsividade: 5,
                    perfeccionismo: 5,
                    profundidade: 5,
                    vulnerabilidade: 5,
                    engajamento: 5
                },
                lastUpdated: now
            },
            firstSeen: now,
            lastActivity: now
        });
    }
    return userBehaviors.get(jid);
}

// ═══════════════════════════════════════════════════════════════
// HOOKS DE EVENTOS BAILEYS
// ═══════════════════════════════════════════════════════════════

/**
 * Processa evento de presença (composing, available, etc)
 * @param {string} jid
 * @param {string} status - composing, recording, available, unavailable, paused
 */
export function onPresenceUpdate(jid, status) {
    const behavior = getOrCreateBehavior(jid);
    const now = Date.now();
    const previousStatus = behavior.presence.currentStatus;

    behavior.presence.currentStatus = status;
    behavior.presence.lastSeen = now;
    behavior.lastActivity = now;

    // Rastrear padrões de digitação
    if (status === 'composing' || status === 'recording') {
        // Começou a digitar
        if (!activeTyping.has(jid)) {
            activeTyping.set(jid, {
                status,
                startedAt: now,
                cycles: 0
            });
            console.log(`[Behavior] ${jid.split('@')[0]} começou a digitar`);
        }
    } else if (status === 'paused') {
        // Pausou a digitação (hesitação)
        const typing = activeTyping.get(jid);
        if (typing) {
            typing.cycles++;
            console.log(`[Behavior] ${jid.split('@')[0]} hesitou (ciclo ${typing.cycles})`);
        }
    } else if (status === 'available') {
        // Ficou online
        const timeSinceLastBotMessage = now - (lastMessageSentByBot.get(jid) || 0);

        // Se o bot mandou mensagem há menos de 1h e pessoa ficou online sem responder
        if (timeSinceLastBotMessage < 3600000 && timeSinceLastBotMessage > 30000) {
            behavior.presence.onlineWithoutResponse++;
            console.log(`[Behavior] ${jid.split('@')[0]} online sem responder (${behavior.presence.onlineWithoutResponse}x)`);
        }
    }

    // Registrar atividade temporal
    const hour = new Date(now).getHours();
    const day = new Date(now).getDay();

    const hourCount = behavior.temporal.hourActivity.get(hour) || 0;
    behavior.temporal.hourActivity.set(hour, hourCount + 1);

    const dayCount = behavior.temporal.dayActivity.get(day) || 0;
    behavior.temporal.dayActivity.set(day, dayCount + 1);

    // Detectar padrão noturno (madrugada)
    if (hour >= 0 && hour < 5) {
        const nightActivity = (behavior.temporal.hourActivity.get(0) || 0) +
                              (behavior.temporal.hourActivity.get(1) || 0) +
                              (behavior.temporal.hourActivity.get(2) || 0) +
                              (behavior.temporal.hourActivity.get(3) || 0) +
                              (behavior.temporal.hourActivity.get(4) || 0);
        const totalActivity = Array.from(behavior.temporal.hourActivity.values()).reduce((a, b) => a + b, 0);
        behavior.temporal.nightOwl = nightActivity / Math.max(totalActivity, 1) > 0.3;
    }

    // Atualizar perfil periodicamente
    if (now - behavior.profile.lastUpdated > 60000) { // A cada minuto
        updateProfile(jid);
    }
}

/**
 * Processa quando usuário envia uma mensagem
 * @param {string} jid
 * @param {string} text
 * @param {boolean} isAudio
 */
export function onMessageReceived(jid, text, isAudio = false) {
    const behavior = getOrCreateBehavior(jid);
    const now = Date.now();

    // Finalizar rastreamento de digitação
    const typing = activeTyping.get(jid);
    if (typing) {
        const duration = now - typing.startedAt;
        behavior.presence.typingPatterns.push({
            startedAt: typing.startedAt,
            pausedAt: 0,
            sentAt: now,
            cycles: typing.cycles,
            totalDuration: duration
        });

        // Manter apenas últimos 20 padrões
        if (behavior.presence.typingPatterns.length > 20) {
            behavior.presence.typingPatterns.shift();
        }

        activeTyping.delete(jid);

        console.log(`[Behavior] ${jid.split('@')[0]} digitou por ${Math.round(duration/1000)}s com ${typing.cycles} hesitações`);
    }

    // Calcular tempo de resposta (desde última msg do bot)
    const lastBotMsg = lastMessageSentByBot.get(jid);
    if (lastBotMsg) {
        const responseTime = now - lastBotMsg;
        behavior.presence.responseTimes.push(responseTime);

        // Manter apenas últimos 50
        if (behavior.presence.responseTimes.length > 50) {
            behavior.presence.responseTimes.shift();
        }

        // Recalcular média
        behavior.presence.avgResponseTime =
            behavior.presence.responseTimes.reduce((a, b) => a + b, 0) /
            behavior.presence.responseTimes.length;
    }

    // Dados de mensagem
    if (isAudio) {
        behavior.messaging.audioCount++;
    } else {
        behavior.messaging.textCount++;
        behavior.messaging.messageLengths.push(text.length);

        // Manter últimos 50
        if (behavior.messaging.messageLengths.length > 50) {
            behavior.messaging.messageLengths.shift();
        }

        // Recalcular média
        behavior.messaging.avgMessageLength =
            behavior.messaging.messageLengths.reduce((a, b) => a + b, 0) /
            behavior.messaging.messageLengths.length;
    }

    // Detectar burst de mensagens
    behavior.messaging.messageTimestamps.push(now);

    // Manter últimos 100 timestamps
    if (behavior.messaging.messageTimestamps.length > 100) {
        behavior.messaging.messageTimestamps.shift();
    }

    // Contar mensagens nos últimos 30 segundos
    const recentMessages = behavior.messaging.messageTimestamps.filter(t => now - t < 30000);
    if (recentMessages.length >= 3) {
        behavior.messaging.burstMessages++;
        console.log(`[Behavior] ${jid.split('@')[0]} enviando em rajada (${recentMessages.length} msgs em 30s)`);
    }

    behavior.lastActivity = now;

    // Resolver waiters
    if (typingWaiters.has(jid)) {
        typingWaiters.delete(jid);
    }

    // Atualizar perfil
    updateProfile(jid);
}

/**
 * Processa edição de mensagem
 * @param {string} jid
 */
export function onMessageEdited(jid) {
    const behavior = getOrCreateBehavior(jid);
    behavior.messaging.editedMessages++;
    console.log(`[Behavior] ${jid.split('@')[0]} editou mensagem (total: ${behavior.messaging.editedMessages})`);
    updateProfile(jid);
}

/**
 * Processa deleção de mensagem
 * @param {string} jid
 */
export function onMessageDeleted(jid) {
    const behavior = getOrCreateBehavior(jid);
    behavior.messaging.deletedMessages++;
    console.log(`[Behavior] ${jid.split('@')[0]} deletou mensagem (total: ${behavior.messaging.deletedMessages})`);
    updateProfile(jid);
}

/**
 * Registra quando o bot enviou mensagem (para calcular tempo de resposta)
 * @param {string} jid
 */
export function onBotMessageSent(jid) {
    lastMessageSentByBot.set(jid, Date.now());
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISE DE PERFIL
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula e atualiza o perfil comportamental
 * @param {string} jid
 */
function updateProfile(jid) {
    const behavior = getOrCreateBehavior(jid);
    const traits = behavior.profile.traits;
    const now = Date.now();

    // ─────────────────────────────────────────────────────────────
    // ANSIEDADE
    // Indicadores: digitação longa, muitas hesitações, resposta rápida
    // ─────────────────────────────────────────────────────────────
    let ansiedadeScore = 5;

    // Tempo médio de digitação alto = ansiedade (pensa muito antes de enviar)
    const avgTypingTime = behavior.presence.typingPatterns.length > 0
        ? behavior.presence.typingPatterns.reduce((a, p) => a + p.totalDuration, 0) / behavior.presence.typingPatterns.length
        : 0;

    if (avgTypingTime > 30000) ansiedadeScore += 2; // >30s digitando
    else if (avgTypingTime > 15000) ansiedadeScore += 1; // >15s digitando

    // Muitas hesitações (ciclos de composing->paused->composing)
    const avgCycles = behavior.presence.typingPatterns.length > 0
        ? behavior.presence.typingPatterns.reduce((a, p) => a + p.cycles, 0) / behavior.presence.typingPatterns.length
        : 0;

    if (avgCycles >= 3) ansiedadeScore += 2;
    else if (avgCycles >= 1) ansiedadeScore += 1;

    // Resposta muito rápida = pode ser ansiedade de aprovação
    if (behavior.presence.avgResponseTime > 0 && behavior.presence.avgResponseTime < 30000) {
        ansiedadeScore += 1;
    }

    // Bursts de mensagem = ansiedade
    if (behavior.messaging.burstMessages > 5) ansiedadeScore += 2;
    else if (behavior.messaging.burstMessages > 2) ansiedadeScore += 1;

    traits.ansiedade = Math.min(10, Math.max(0, ansiedadeScore));

    // ─────────────────────────────────────────────────────────────
    // EVITAÇÃO
    // Indicadores: online sem responder, respostas curtas, deleta msgs
    // ─────────────────────────────────────────────────────────────
    let evitacaoScore = 5;

    // Online sem responder
    if (behavior.presence.onlineWithoutResponse >= 5) evitacaoScore += 3;
    else if (behavior.presence.onlineWithoutResponse >= 2) evitacaoScore += 1;

    // Mensagens muito curtas
    if (behavior.messaging.avgMessageLength < 20 && behavior.messaging.textCount > 5) {
        evitacaoScore += 2;
    }

    // Deleta mensagens frequentemente
    const deleteRatio = behavior.messaging.deletedMessages / Math.max(behavior.messaging.textCount, 1);
    if (deleteRatio > 0.2) evitacaoScore += 2;
    else if (deleteRatio > 0.1) evitacaoScore += 1;

    // Demora muito para responder
    if (behavior.presence.avgResponseTime > 3600000) evitacaoScore += 2; // >1h
    else if (behavior.presence.avgResponseTime > 1800000) evitacaoScore += 1; // >30min

    traits.evitacao = Math.min(10, Math.max(0, evitacaoScore));

    // ─────────────────────────────────────────────────────────────
    // IMPULSIVIDADE
    // Indicadores: mensagens rápidas, edições, bursts
    // ─────────────────────────────────────────────────────────────
    let impulsividadeScore = 5;

    // Digitação curta = não pensa muito
    if (avgTypingTime < 3000 && avgTypingTime > 0) impulsividadeScore += 2;

    // Bursts de mensagens
    if (behavior.messaging.burstMessages > 10) impulsividadeScore += 2;
    else if (behavior.messaging.burstMessages > 3) impulsividadeScore += 1;

    // Edita depois de enviar (arrependimento impulsivo)
    const editRatio = behavior.messaging.editedMessages / Math.max(behavior.messaging.textCount, 1);
    if (editRatio > 0.15) impulsividadeScore += 2;
    else if (editRatio > 0.05) impulsividadeScore += 1;

    traits.impulsividade = Math.min(10, Math.max(0, impulsividadeScore));

    // ─────────────────────────────────────────────────────────────
    // PERFECCIONISMO
    // Indicadores: digitação longa, edições, hesitações
    // ─────────────────────────────────────────────────────────────
    let perfeccionismoScore = 5;

    // Muitas edições = quer que fique perfeito
    if (editRatio > 0.2) perfeccionismoScore += 2;
    else if (editRatio > 0.1) perfeccionismoScore += 1;

    // Digitação longa com poucas hesitações = pensando bem
    if (avgTypingTime > 20000 && avgCycles < 1) perfeccionismoScore += 2;

    // Mensagens mais elaboradas
    if (behavior.messaging.avgMessageLength > 100) perfeccionismoScore += 1;

    traits.perfeccionismo = Math.min(10, Math.max(0, perfeccionismoScore));

    // ─────────────────────────────────────────────────────────────
    // PROFUNDIDADE
    // Indicadores: mensagens longas, áudios, horários reflexivos
    // ─────────────────────────────────────────────────────────────
    let profundidadeScore = 5;

    // Mensagens longas
    if (behavior.messaging.avgMessageLength > 150) profundidadeScore += 2;
    else if (behavior.messaging.avgMessageLength > 80) profundidadeScore += 1;

    // Usa áudios (busca conexão mais profunda)
    const audioRatio = behavior.messaging.audioCount / Math.max(behavior.messaging.textCount + behavior.messaging.audioCount, 1);
    if (audioRatio > 0.3) profundidadeScore += 2;
    else if (audioRatio > 0.1) profundidadeScore += 1;

    // Ativo em horários reflexivos (noite/madrugada)
    if (behavior.temporal.nightOwl) profundidadeScore += 1;

    traits.profundidade = Math.min(10, Math.max(0, profundidadeScore));

    // ─────────────────────────────────────────────────────────────
    // VULNERABILIDADE
    // Indicadores: madrugada, mensagens longas, padrões de crise
    // ─────────────────────────────────────────────────────────────
    let vulnerabilidadeScore = 5;

    // Ativo de madrugada
    if (behavior.temporal.nightOwl) vulnerabilidadeScore += 2;

    // Muitas hesitações (insegurança)
    if (avgCycles >= 2) vulnerabilidadeScore += 1;

    // Deleta mensagens (arrependimento, medo de julgamento)
    if (deleteRatio > 0.1) vulnerabilidadeScore += 1;

    traits.vulnerabilidade = Math.min(10, Math.max(0, vulnerabilidadeScore));

    // ─────────────────────────────────────────────────────────────
    // ENGAJAMENTO
    // Indicadores: frequência, respostas, reações
    // ─────────────────────────────────────────────────────────────
    let engajamentoScore = 5;

    const totalMessages = behavior.messaging.textCount + behavior.messaging.audioCount;
    if (totalMessages > 50) engajamentoScore += 2;
    else if (totalMessages > 20) engajamentoScore += 1;

    // Responde rápido
    if (behavior.presence.avgResponseTime < 300000) engajamentoScore += 1; // <5min

    // Não evita
    if (behavior.presence.onlineWithoutResponse < 2) engajamentoScore += 1;

    traits.engajamento = Math.min(10, Math.max(0, engajamentoScore));

    // ─────────────────────────────────────────────────────────────
    // DETERMINAR PERFIL DOMINANTE
    // ─────────────────────────────────────────────────────────────

    // Detectar crise primeiro (prioridade máxima)
    const hour = new Date().getHours();
    const isNightTime = hour >= 0 && hour < 5;
    const recentBursts = behavior.messaging.messageTimestamps.filter(t => now - t < 60000).length;

    if (isNightTime && (traits.vulnerabilidade >= 7 || recentBursts >= 5)) {
        behavior.profile.type = 'em_crise';
        behavior.profile.confidence = 0.8;
    } else if (traits.ansiedade >= 7 && traits.ansiedade > traits.evitacao) {
        behavior.profile.type = 'ansioso';
        behavior.profile.confidence = traits.ansiedade / 10;
    } else if (traits.evitacao >= 7) {
        behavior.profile.type = 'evitativo';
        behavior.profile.confidence = traits.evitacao / 10;
    } else if (traits.impulsividade >= 7) {
        behavior.profile.type = 'impulsivo';
        behavior.profile.confidence = traits.impulsividade / 10;
    } else if (traits.perfeccionismo >= 7) {
        behavior.profile.type = 'perfeccionista';
        behavior.profile.confidence = traits.perfeccionismo / 10;
    } else if (traits.profundidade >= 7) {
        behavior.profile.type = 'reflexivo';
        behavior.profile.confidence = traits.profundidade / 10;
    } else {
        behavior.profile.type = 'equilibrado';
        behavior.profile.confidence = 0.5;
    }

    behavior.profile.lastUpdated = now;

    // Log apenas quando muda
    console.log(`[Behavior] Perfil ${jid.split('@')[0]}: ${behavior.profile.type} (${Math.round(behavior.profile.confidence * 100)}%)`);
}

// ═══════════════════════════════════════════════════════════════
// ADAPTAÇÃO DE RESPOSTA
// ═══════════════════════════════════════════════════════════════

/**
 * Retorna instruções para adaptar a resposta baseado no perfil
 * @param {string} jid
 * @returns {{
 *   tone: string,
 *   length: string,
 *   priority: string,
 *   hints: string[],
 *   contextString: string
 * }}
 */
export function getResponseAdaptation(jid) {
    const behavior = getOrCreateBehavior(jid);
    const profile = behavior.profile;
    const traits = profile.traits;

    const adaptation = {
        tone: 'neutro',
        length: 'media',
        priority: 'normal',
        hints: [],
        contextString: ''
    };

    // Adaptar baseado no perfil dominante
    switch (profile.type) {
        case 'em_crise':
            adaptation.tone = 'muito_calmo';
            adaptation.length = 'curta';
            adaptation.priority = 'maxima';
            adaptation.hints = [
                'Acolhimento imediato',
                'Não faça muitas perguntas',
                'Valide o sentimento',
                'Pergunte se está seguro',
                'Ofereça presença constante'
            ];
            adaptation.contextString = `[ALERTA: POSSÍVEL CRISE]
- Horário: madrugada
- Padrão: mensagens urgentes ou silêncio após atividade
- PRIORIDADE MÁXIMA: Acolher primeiro, perguntar se está seguro
- Tom muito calmo, respostas curtas, apenas presença`;
            break;

        case 'ansioso':
            adaptation.tone = 'calmo';
            adaptation.length = 'media';
            adaptation.priority = 'alta';
            adaptation.hints = [
                'Não pressione por respostas',
                'Valide antes de questionar',
                'Evite fazer muitas perguntas de uma vez',
                'Seja previsível e constante'
            ];
            adaptation.contextString = `[PERFIL: Ansioso]
- Indicadores: digitação longa (${Math.round(behavior.presence.typingPatterns.reduce((a, p) => a + p.totalDuration, 0) / Math.max(behavior.presence.typingPatterns.length, 1) / 1000)}s média), ${Math.round(behavior.presence.typingPatterns.reduce((a, p) => a + p.cycles, 0) / Math.max(behavior.presence.typingPatterns.length, 1))} hesitações por msg
- Tom calmo e acolhedor
- Validar sentimentos antes de qualquer orientação
- Evitar múltiplas perguntas`;
            break;

        case 'evitativo':
            adaptation.tone = 'leve';
            adaptation.length = 'curta';
            adaptation.priority = 'normal';
            adaptation.hints = [
                'Não cobre resposta',
                'Dê espaço',
                'Mensagens mais curtas',
                'Não demonstre que notou a evitação'
            ];
            adaptation.contextString = `[PERFIL: Evitativo]
- Indicadores: ${behavior.presence.onlineWithoutResponse}x online sem responder, msgs curtas (${Math.round(behavior.messaging.avgMessageLength)} chars média)
- NÃO pressionar ou cobrar
- Mensagens curtas e leves
- Dar espaço, não parecer carente`;
            break;

        case 'impulsivo':
            adaptation.tone = 'reflexivo';
            adaptation.length = 'media';
            adaptation.priority = 'normal';
            adaptation.hints = [
                'Ajude a refletir',
                'Faça perguntas que façam pensar',
                'Não responda na mesma velocidade',
                'Traga calma para a conversa'
            ];
            adaptation.contextString = `[PERFIL: Impulsivo]
- Indicadores: ${behavior.messaging.burstMessages} rajadas de msgs, ${behavior.messaging.editedMessages} edições
- Trazer ritmo mais calmo para a conversa
- Perguntas reflexivas que façam pensar
- Não alimentar a urgência`;
            break;

        case 'perfeccionista':
            adaptation.tone = 'acolhedor';
            adaptation.length = 'media';
            adaptation.priority = 'normal';
            adaptation.hints = [
                'Valide o esforço, não só o resultado',
                'Não julgue imperfeições',
                'Reconheça o cuidado nas palavras',
                'Permita vulnerabilidade'
            ];
            adaptation.contextString = `[PERFIL: Perfeccionista]
- Indicadores: ${behavior.messaging.editedMessages} edições, digitação elaborada
- Validar o esforço e cuidado
- Não cobrar perfeição
- Criar espaço seguro para imperfeições`;
            break;

        case 'reflexivo':
            adaptation.tone = 'profundo';
            adaptation.length = 'elaborada';
            adaptation.priority = 'normal';
            adaptation.hints = [
                'Respostas mais profundas são bem-vindas',
                'Dê tempo para processar',
                'Traga reflexões e não só respostas',
                'Pode trazer passagens ou histórias'
            ];
            adaptation.contextString = `[PERFIL: Reflexivo]
- Indicadores: msgs longas (${Math.round(behavior.messaging.avgMessageLength)} chars), ${behavior.temporal.nightOwl ? 'ativo de madrugada' : 'horários variados'}
- Respostas podem ser mais elaboradas
- Trazer reflexões profundas
- Histórias e passagens são bem-vindas`;
            break;

        default:
            adaptation.tone = 'equilibrado';
            adaptation.length = 'media';
            adaptation.priority = 'normal';
            adaptation.hints = [
                'Seguir fluxo natural',
                'Observar reações'
            ];
            adaptation.contextString = `[PERFIL: Equilibrado]
- Sem padrões extremos detectados
- Seguir fluxo natural da conversa`;
    }

    // Adicionar contexto temporal
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5 && behavior.temporal.nightOwl) {
        adaptation.hints.push('Pessoa costuma estar acordada de madrugada - pode indicar insônia ou reflexão');
        adaptation.contextString += '\n[TEMPORAL: Padrão noturno confirmado]';
    }

    // Adicionar contexto de áudio
    if (behavior.messaging.audioCount > behavior.messaging.textCount * 0.3) {
        adaptation.hints.push('Pessoa usa muito áudio - considere mencionar que pode mandar áudio também');
    }

    return adaptation;
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE CONTROLE DE DIGITAÇÃO
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica se usuário está digitando
 * @param {string} jid
 * @returns {boolean}
 */
export function isTyping(jid) {
    const behavior = userBehaviors.get(jid);
    if (!behavior) return false;

    const status = behavior.presence.currentStatus;
    const isActiveTyping = status === 'composing' || status === 'recording';

    // Verificar se não é um estado "stale" (mais de 2 minutos)
    if (isActiveTyping && Date.now() - behavior.presence.lastSeen > 120000) {
        behavior.presence.currentStatus = 'unknown';
        return false;
    }

    return isActiveTyping;
}

/**
 * Aguarda usuário terminar de digitar (com timeout)
 * @param {string} jid
 * @param {number} maxWait - Tempo máximo de espera em ms (default: 30s)
 * @returns {Promise<boolean>} - true se terminou, false se timeout
 */
export async function waitForTypingEnd(jid, maxWait = 30000) {
    if (!isTyping(jid)) return true;

    console.log(`[Behavior] Aguardando ${jid.split('@')[0]} terminar de digitar...`);

    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
            if (!isTyping(jid)) {
                clearInterval(checkInterval);
                console.log(`[Behavior] ${jid.split('@')[0]} terminou de digitar`);
                resolve(true);
            } else if (Date.now() - startTime > maxWait) {
                clearInterval(checkInterval);
                console.log(`[Behavior] Timeout esperando ${jid.split('@')[0]}`);
                resolve(false);
            }
        }, 500);
    });
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES DE CONSULTA
// ═══════════════════════════════════════════════════════════════

/**
 * Retorna o perfil comportamental de um usuário
 * @param {string} jid
 * @returns {BehaviorProfile}
 */
export function getProfile(jid) {
    const behavior = getOrCreateBehavior(jid);
    return behavior.profile;
}

/**
 * Retorna todos os dados comportamentais (para debug/análise)
 * @param {string} jid
 * @returns {UserBehavior}
 */
export function getFullBehaviorData(jid) {
    return getOrCreateBehavior(jid);
}

/**
 * Verifica se devemos esperar antes de responder
 * @param {string} jid
 * @returns {{shouldWait: boolean, reason: string, recommendedDelay: number}}
 */
export function shouldDelayResponse(jid) {
    const behavior = userBehaviors.get(jid);

    if (!behavior) {
        return { shouldWait: false, reason: 'novo_usuario', recommendedDelay: 0 };
    }

    // Se está digitando, esperar
    if (isTyping(jid)) {
        return { shouldWait: true, reason: 'digitando', recommendedDelay: 30000 };
    }

    // Para perfis ansiosos, não demorar muito (pode gerar mais ansiedade)
    if (behavior.profile.type === 'ansioso') {
        return { shouldWait: false, reason: 'ansioso_responder_rapido', recommendedDelay: 0 };
    }

    // Para perfis evitativos, dar um pouco mais de espaço
    if (behavior.profile.type === 'evitativo') {
        return { shouldWait: true, reason: 'evitativo_dar_espaco', recommendedDelay: 5000 };
    }

    return { shouldWait: false, reason: 'normal', recommendedDelay: 0 };
}

/**
 * Retorna estatísticas gerais (para monitoramento)
 */
export function getStats() {
    const profiles = {};
    let totalUsers = 0;

    for (const [jid, behavior] of userBehaviors) {
        totalUsers++;
        const type = behavior.profile.type;
        profiles[type] = (profiles[type] || 0) + 1;
    }

    return {
        totalUsers,
        profileDistribution: profiles,
        activeTyping: activeTyping.size
    };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT DEFAULT
// ═══════════════════════════════════════════════════════════════

export default {
    // Hooks de eventos
    onPresenceUpdate,
    onMessageReceived,
    onMessageEdited,
    onMessageDeleted,
    onBotMessageSent,

    // Controle de digitação
    isTyping,
    waitForTypingEnd,

    // Consultas
    getProfile,
    getResponseAdaptation,
    getFullBehaviorData,
    shouldDelayResponse,
    getStats
};
