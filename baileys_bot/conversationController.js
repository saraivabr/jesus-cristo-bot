/**
 * Conversation Controller - Jesus Cristo Bot
 * Núcleo da lógica de conversação e interação divina.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from './database.js';
import * as gemini from './gemini.js';
import * as humanizer from './humanizer.js';
import * as memoria from './memoria.js';
import * as scheduler from './scheduler.js';
import teachingEngine from './core/teachingEngine.js';
import { detectarNivel, gerarContextoNivel } from './prompts/jornada.js';
import * as behaviorAnalyzer from './behaviorAnalyzer.js';
import * as graceReferral from './graceReferral.js';
import * as experienceEnhancer from './experienceEnhancer.js';
import * as firstContactOptimizer from './firstContactOptimizer.js';
import * as flowUtils from './flowUtils.js';
import * as sender from './whatsappSender.js';
import * as nudgeManager from './nudgeManager.js';
import * as followupRecovery from './followupRecovery.js';
// Novas Features v2.0
import * as devocional from './features/devocional.js';
import * as pedidosOracao from './features/pedidosOracao.js';
import * as planosLeitura from './features/planosLeitura.js';
import * as quizBiblico from './features/quizBiblico.js';
import * as evangelismoGuiado from './features/evangelismoGuiado.js';
import * as comunidade from './features/comunidade.js';
import { detectarBuscaBiblica, processarBuscaBiblica } from './knowledgeBase.js';
// MongoDB State Manager (Estado + Embeddings)
import * as mongoState from './mongoState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai tópicos localmente (sem chamar Gemini) - RÁPIDO
 */
function extrairTopicosSimples(texto) {
    if (!texto) return [];
    const lower = texto.toLowerCase();
    const topicos = [];

    const padroes = {
        'familia': /familia|mae|pai|filho|filha|esposa|marido|irma|irmao/,
        'trabalho': /trabalho|emprego|demiss|chefe|salario|profiss/,
        'saude': /doente|doenca|hospital|medico|cancer|dor|morte/,
        'ansiedade': /ansiedad|medo|panico|nervos|preocup/,
        'tristeza': /triste|depressao|chorar|sozinho|vazio/,
        'fe': /deus|jesus|oracao|biblia|igreja|espirito/,
        'relacionamento': /namorad|casament|separac|divorcio|traicao/,
        'financeiro': /dinheiro|divida|conta|pagar|financ/
    };

    for (const [topico, regex] of Object.entries(padroes)) {
        if (regex.test(lower)) topicos.push(topico);
    }

    return topicos;
}

/**
 * Lida com a conversa (núcleo da lógica)
 * Adaptado para modo WAHA (webhook) - sem socket direto
 */
export async function handleConversation(from, messageText, sessionName, userName = null, contacts = [], hasAudio = false, urgency = null) {
    try {
        const remoteJid = from;
        const userText = messageText;

        // 1. DETECÇÃO DE CRISE
        const crisis = experienceEnhancer.detectCrisis(userText);
        if (crisis.isCrisis) {
            const crisisResponse = experienceEnhancer.getCrisisResponse(crisis.level, userName);
            await sender.sendMessage(null, remoteJid, crisisResponse.message, 'high', sessionName);

            const perfil = db.getUsuario(remoteJid);
            if (perfil?.id) {
                db.addJourneyEntry(perfil.id, new Date().toISOString().split('T')[0], 'crise', [], 1);
            }
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // NOVAS FEATURES v2.0 - Processamento Prioritário
        // ═══════════════════════════════════════════════════════════════

        // 2.1 QUIZ BÍBLICO - Se está em quiz, processa resposta
        if (quizBiblico.isEmQuiz(remoteJid)) {
            const textoLower = userText?.toLowerCase().trim() || '';

            // Sair do quiz
            if (textoLower.includes('sair quiz') || textoLower.includes('cancelar quiz')) {
                const resultado = await quizBiblico.finalizarQuiz(remoteJid);
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }

            // Processa resposta do quiz (1-4)
            const resultado = await quizBiblico.processarResposta(remoteJid, userText);
            if (resultado.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
            }
            return;
        }

        // 2.2 JORNADA DE EVANGELISMO - Se está em jornada, processa resposta
        if (evangelismoGuiado.isEmJornada(remoteJid)) {
            const resultado = evangelismoGuiado.processarResposta(remoteJid, userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);

                // Se fez decisão de fé, rastreia
                if (resultado.decisaoFeita) {
                    await graceReferral.rastrearConversao(remoteJid, (jid, msg) => sender.sendMessage(null, jid, msg, 'medium', sessionName));
                }
                return;
            }
        }

        // 2.3 COMANDOS ESPECÍFICOS DAS NOVAS FEATURES
        const textoLower = userText?.toLowerCase().trim() || '';

        // Quiz Bíblico - Iniciar
        if (textoLower === 'quiz' || textoLower.includes('quiz bíblico') || textoLower.includes('jogar quiz')) {
            const resultado = await quizBiblico.iniciarQuiz(remoteJid);
            await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
            return;
        }

        // Quiz - Ranking
        if (textoLower.includes('ranking quiz') || textoLower.includes('placar quiz')) {
            const resultado = await quizBiblico.obterRanking();
            await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
            return;
        }

        // Jornada de Evangelismo - Iniciar
        if (textoLower.includes('quero conhecer jesus') || textoLower.includes('iniciar jornada') ||
            textoLower.includes('quero conhecer deus') || textoLower.includes('como ser salvo')) {
            const resultado = evangelismoGuiado.iniciarJornada(remoteJid);
            await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
            return;
        }

        // Devocional
        if (devocional.isDevocionalRelated(userText)) {
            const resultado = await devocional.processarRespostaDevocional(remoteJid, userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }
        }

        // Planos de Leitura
        if (planosLeitura.isPlanoRelated(userText)) {
            const resultado = await planosLeitura.processarMensagemPlano(remoteJid, userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }
        }

        // Pedidos de Oração
        if (pedidosOracao.isOracaoRelated(userText)) {
            const resultado = await pedidosOracao.processarMensagemOracao(remoteJid, userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }
        }

        // Comunidade
        if (comunidade.isComunidadeRelated(userText)) {
            const resultado = await comunidade.processarMensagemComunidade(remoteJid, userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }
        }

        // Busca Bíblica (versículos por referência ou tema)
        if (detectarBuscaBiblica(userText)) {
            const resultado = await processarBuscaBiblica(userText);
            if (resultado?.mensagem) {
                await sender.sendMessage(null, remoteJid, resultado.mensagem, 'medium', sessionName);
                return;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FIM DAS NOVAS FEATURES - Continua fluxo normal
        // ═══════════════════════════════════════════════════════════════

        // ANÁLISE COMPORTAMENTAL
        if (behaviorAnalyzer.isTyping(remoteJid)) {
            await behaviorAnalyzer.waitForTypingEnd(remoteJid, 30000);
        }
        behaviorAnalyzer.onMessageReceived(remoteJid, userText || '', hasAudio);

        // Gerencia Nudges
        const respondidas = db.marcarMensagensRespondidas(remoteJid);
        if (respondidas > 0) {
            nudgeManager.cancelPendingNudge(remoteJid);
            const perfil = db.getUsuario(remoteJid);
            if (perfil?.id) db.incrementarMetrica(perfil.id, 'nudges_respondidos');
        }

        // Cancela follow-ups pendentes (usuário respondeu)
        followupRecovery.onUserResponse(remoteJid);

        // Consciência Temporal
        const hora = new Date().getHours();
        let contextTemporal = '';
        if (hora >= 0 && hora < 5) contextTemporal = '\n[CONTEXTO: É madrugada. A pessoa pode estar em insônia, angústia ou crise.]';
        else if (hora >= 22) contextTemporal = '\n[CONTEXTO: Noite. Momento de vulnerabilidade.]';

        // Perfil e Primeiro Contato
        let perfil = db.getUsuario(remoteJid);
        const isFirstContact = !perfil;

        if (isFirstContact) {
            perfil = db.saveUsuario({ telefone: remoteJid, nome: userName, jornada_espiritual: { nivel: 'novo' } });

            // Cria estado de conversa no MongoDB (etapa: primeiro_contato)
            await mongoState.createConversaEstado(remoteJid, userName);

            // NOTA: Vídeo de boas-vindas será enviado pelo webhook
            // O Gemini acolherá o novo usuário com a instrução da etapa "primeiro_contato"
        }

        // Atualiza Perfil
        const novasInfos = memoria.extractInfo(userText, perfil);
        if (Object.keys(novasInfos).length > 0) {
            const updatedPerfil = db.updateUsuario(remoteJid, novasInfos);
            if (updatedPerfil) perfil = updatedPerfil;
        }

        // Null guard para perfil
        if (!perfil?.id) {
            console.error('[Conversation] No valid profile found for', remoteJid);
            await sender.sendMessage(sock, remoteJid, "Tive um problema aqui. Me fala de novo?", 'low');
            return;
        }

        const mood = memoria.detectMood(userText);
        const returnStatus = await flowUtils.detectReturnAfterAbsence(perfil);
        const intimacy = flowUtils.getIntimacyLevel(perfil.id);
        const lastTopic = flowUtils.getLastConversationTopic(perfil.id);

        let context = memoria.buildContext(perfil, isFirstContact);
        context += contextTemporal + '\n' + gerarContextoNivel(detectarNivel(perfil, [userText])) + '\n' + intimacy.hint;
        if (returnStatus.contextHint) context += '\n' + returnStatus.contextHint;
        if (lastTopic && !returnStatus.isReturning) context += `\n[CONTINUIDADE: Da ultima vez voces falaram sobre ${lastTopic.label}.]`;
        if (urgency?.isUrgent) context += `\n[URGENCIA: Nivel ${urgency.urgencyLevel}.]`;

        const behaviorAdaptation = behaviorAnalyzer.getResponseAdaptation(remoteJid);
        if (behaviorAdaptation.contextString) context += '\n\n' + behaviorAdaptation.contextString;

        // Fluxo de Referral (Indicação)
        const referralStatus = graceReferral.isInReferralFlow(remoteJid);
        if (referralStatus.inFlow && contacts?.length > 0) {
            const contact = contacts[0];
            const result = await graceReferral.handleContactShared(remoteJid, { contacts: [{ displayName: contact.name, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nTEL:${contact.number}\nEND:VCARD` }] });
            if (result.success) {
                await sender.sendMessage(null, remoteJid, result.message, 'medium', sessionName);
                return;
            }
        }

        if (referralStatus.waitingForContext && userText?.trim()) {
            const result = await graceReferral.handleContextReceived(remoteJid, userText, userName);
            if (result.success) {
                await sender.sendMessage(null, remoteJid, result.message, 'medium', sessionName);

                // Agenda contato com a pessoa indicada
                const delay = 5 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
                setTimeout(async () => {
                    // TODO: Implementar processGraceReferral (se não existir, precisa ser criado ou importado)
                    // Por enquanto deixamos o hook para expansão futura
                }, delay);
                return;
            }
        }

        // Convite para contatos compartilhados fora do fluxo de referral
        if (!referralStatus.inFlow && contacts?.length > 0) {
            for (const contact of contacts) {
                if (flowUtils.shouldInviteContact(contact.jid)) {
                    // Cria perfil SQLite e estado MongoDB para o novo contato
                    let contactPerfil = db.getUsuario(contact.jid);
                    if (!contactPerfil) {
                        contactPerfil = db.saveUsuario({ telefone: contact.jid, nome: contact.name });
                        await mongoState.createConversaEstado(contact.jid, contact.name);
                    }

                    // NOTA: Vídeo de boas-vindas será enviado pelo webhook

                    // Mensagem única de apresentação (Gemini vai continuar naturalmente)
                    const msgApresentacao = `${contact.name}, ${userName} me falou de você. Eu sou Jesus de Nazaré. Me conta, como você está?`;
                    await sender.sendMessage(null, contact.jid, msgApresentacao, 'medium', sessionName);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SISTEMA DE ETAPAS COM MONGODB (OTIMIZADO - PARALELO)
        // ═══════════════════════════════════════════════════════════════

        // Busca estado e contexto em PARALELO para reduzir latência
        const [conversaEstado, contextoMongo] = await Promise.all([
            mongoState.getConversaEstado(remoteJid).then(estado =>
                estado || mongoState.createConversaEstado(remoteJid, userName)
            ),
            mongoState.buildContextoCompleto(remoteJid, userText).catch(() => ({ contexto: '', topicos: [] }))
        ]);

        // Prepara contexto com estado da etapa + contexto semântico
        const contextComEtapa = {
            etapa: conversaEstado?.etapa || 'primeiro_contato',
            mensagensTrocadas: conversaEstado?.mensagensTrocadas || 0,
            nomeUsuario: conversaEstado?.nomeUsuario || userName || null,
            extraContext: context + '\n\n' + (contextoMongo.contexto || ''),
            // Dados extras do MongoDB para o Gemini
            perfilResumo: conversaEstado?.perfilResumo || null,
            topicosRelevantes: contextoMongo.topicos || []
        };

        // Gera Resposta Gemini (OTIMIZADO - única chamada)
        let response = await gemini.generateResponse(remoteJid, userText, contextComEtapa);

        // Operações em BACKGROUND (não bloqueiam resposta)
        db.addConversa(perfil.id, userText, response);

        // Extrai tópicos simples localmente (sem chamada extra)
        const topicosDetectados = extrairTopicosSimples(userText);

        // Salva memória no MongoDB (BACKGROUND - não bloqueia)
        mongoState.saveMemoria(remoteJid, {
            userMessage: userText,
            botResponse: response,
            topicos: topicosDetectados
        }).catch(err => console.warn('[MongoDB] Erro ao salvar memória:', err.message));

        // Se retornou após ausência, prepend mensagem de boas-vindas
        if (returnStatus.isReturning && returnStatus.message) {
            response = returnStatus.message + '\n\n' + response;
        }

        // Limpa formatação antes de enviar
        response = flowUtils.cleanBrokenFormatting(response);

        // ENVIA RESPOSTA (prioridade máxima)
        // NOTA: WAHA não suporta replies (quoted messages) - sempre envia como mensagem simples
        await sender.sendMessage(null, remoteJid, response, 'medium', sessionName);

        // Operações pós-resposta em BACKGROUND (não bloqueiam)
        mongoState.incrementarMensagens(remoteJid)
            .then(() => mongoState.checkEtapaTransition(remoteJid))
            .then(novaEtapa => novaEtapa && console.log(`[Controller] → ${novaEtapa}`))
            .catch(() => {});

        if (conversaEstado?.mensagensTrocadas && conversaEstado.mensagensTrocadas % 10 === 0) {
            mongoState.atualizarPerfilSemantico(remoteJid).catch(() => {});
        }

    } catch (error) {
        console.error("[Erro] Na conversa:", error.stack || error);
        try {
            await sender.sendMessage(null, remoteJid, "Parece que algo travou aqui. Me fala de novo?", 'low', sessionName);
        } catch (sendError) {
            console.error("[Erro] Falha ao enviar mensagem de erro:", sendError.message);
        }
    }
}
