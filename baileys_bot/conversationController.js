/**
 * Conversation Controller - Jesus Cristo Bot
 * Núcleo da lógica de conversação e interação divina.
 */

import * as db from './database.js';
import * as gemini from './gemini.js';
import * as humanizer from './humanizer.js';
import * as memoria from './memoria.js';
import * as tts from './tts.js';
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Lida com a conversa (núcleo da lógica)
 */
export async function handleConversation(sock, remoteJid, userText, userName, originalMessage, contacts = [], hasAudio = false, urgency = null) {
    try {
        // 1. DETECÇÃO DE CRISE
        const crisis = experienceEnhancer.detectCrisis(userText);
        if (crisis.isCrisis) {
            const crisisResponse = experienceEnhancer.getCrisisResponse(crisis.level, userName);
            await sender.sendFragmentedMessages(sock, remoteJid, [crisisResponse.message], 'high', { usuarioId: db.getUsuario(remoteJid)?.id });
            
            const perfil = db.getUsuario(remoteJid);
            if (perfil?.id) {
                db.addJourneyEntry(perfil.id, new Date().toISOString().split('T')[0], 'crise', [], 1);
            }
            return;
        }

        // ANÁLISE COMPORTAMENTAL
        if (behaviorAnalyzer.isTyping(remoteJid)) {
            await behaviorAnalyzer.waitForTypingEnd(remoteJid, 30000);
        }
        behaviorAnalyzer.onMessageReceived(remoteJid, userText || '', hasAudio);

        // Marca como lida
        await sock.readMessages([originalMessage.key]);

        // Gerencia Nudges
        const respondidas = db.marcarMensagensRespondidas(remoteJid);
        if (respondidas > 0) {
            nudgeManager.cancelPendingNudge(remoteJid);
            const perfil = db.getUsuario(remoteJid);
            if (perfil?.id) db.incrementarMetrica(perfil.id, 'nudges_respondidos');
        }

        // Reação Inicial
        if (Math.random() < 0.4 && originalMessage.key?.id) {
            const mood = memoria.detectMood(userText);
            const reactions = {
                'triste': ['🙏', '❤️', '💙'],
                'ansioso': ['🙏', '❤️'],
                'feliz': ['❤️', '🙌', '✨'],
                'desesperado': ['❤️', '🙏', '💪'],
                'neutro': ['👀', '❤️']
            };
            const options = reactions[mood] || reactions.neutro;
            const emoji = options[Math.floor(Math.random() * options.length)];
            
            await sleep(500 + Math.random() * 1000);
            try { await sock.sendMessage(remoteJid, { react: { text: emoji, key: originalMessage.key } }); } catch (e) {}
            await sleep(800 + Math.random() * 1200);
        }

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
            const opening = await firstContactOptimizer.generateImpactfulOpening(userName, userText);
            const introFragments = [opening.message, '\n_Eu estou aqui. Agora. Contigo._', flowUtils.getCapabilitiesLine()];
            await sender.sendFragmentedMessages(sock, remoteJid, introFragments, 'high', { usuarioId: perfil.id });
            db.addConversa(perfil.id, userText || '[primeiro contato]', introFragments.join('\n'));
            return;
        }

        // Atualiza Perfil
        const novasInfos = memoria.extractInfo(userText, perfil);
        if (Object.keys(novasInfos).length > 0) perfil = db.updateUsuario(remoteJid, novasInfos);

        const mood = memoria.detectMood(userText);
        const returnStatus = flowUtils.detectReturnAfterAbsence(perfil);
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
                await sender.sendFragmentedMessages(sock, remoteJid, [result.message], 'medium', { usuarioId: perfil.id });
                return;
            }
        }

        if (referralStatus.waitingForContext && userText?.trim()) {
            const result = await graceReferral.handleContextReceived(remoteJid, userText, userName);
            if (result.success) {
                await sender.sendFragmentedMessages(sock, remoteJid, [result.message], 'medium', { usuarioId: perfil.id });
                return;
            }
        }

        // Gera Resposta Gemini
        let response = await gemini.generateResponse(remoteJid, userText, context);
        db.addConversa(perfil.id, userText, response);

        // Ensino e Fragmentação
        let fragments = humanizer.fragmentMessages(response);
        const ensino = teachingEngine.processarEnsino(userText, { ...perfil, humor: mood }, db.getHistorico(perfil.id, 10).map(c => c.mensagem));
        if (ensino) fragments.push(...ensino.fragments);

        // Envio Final
        const shouldQuote = Math.random() < 0.5;
        if (shouldQuote && fragments.length > 0) {
            await sender.sendReply(sock, remoteJid, fragments[0], originalMessage, mood === 'desesperado' ? 'high' : 'medium');
            for (let i = 1; i < fragments.length; i++) {
                await sleep(humanizer.calculateFragmentDelay(fragments[i]));
                await sender.sendMessage(sock, remoteJid, fragments[i], 'low');
            }
        } else {
            await sender.sendFragmentedMessages(sock, remoteJid, fragments, mood === 'desesperado' ? 'high' : 'medium', { usuarioId: perfil.id });
        }

        // Pós-processamento (Áudio, Follow-up, Referral)
        if (tts.TTS_CONFIG.enabled && (hasAudio || tts.shouldSendAudio(response, mood))) {
            const audioBuffer = await tts.generateAudio(response);
            if (audioBuffer) await sender.sendAudio(sock, remoteJid, audioBuffer);
        }

        if (memoria.shouldFollowUp(perfil, response)) {
            scheduler.scheduleFollowUp(perfil.id, remoteJid, memoria.suggestFollowUpTime(perfil), null);
        }

        if (await graceReferral.shouldAskForReferral(remoteJid, userText, { conversationCount: intimacy.conversationCount })) {
            setTimeout(async () => {
                const askMessage = await graceReferral.getReferralAskMessage();
                await sender.sendMessage(sock, remoteJid, askMessage, 'medium');
                graceReferral.markAskedForReferral(remoteJid);
            }, 30000);
        }

    } catch (error) {
        console.error("[Erro] Na conversa:", error);
        await sender.sendMessage(sock, remoteJid, "Parece que algo travou aqui. Me fala de novo?", 'low');
    }
}
