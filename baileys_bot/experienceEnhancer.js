/**
 * Experience Enhancer - 100% AI Generated
 * Funcionalidades avançadas de interação espiritual (Orações, Desafios, Crises)
 * 
 * ATUALIZADO: Removeu templates estáticos. Usa Gemini para geração contextual.
 */

import * as gemini from './gemini.js';

// ============================================================================
// 1. ORAÇÕES PERSONALIZADAS (AI)
// ============================================================================

export async function generatePersonalizedPrayer(userName, context, mood, situation) {
    try {
        const prompt = `
        Gere uma oração curtíssima (3 frases) em primeira pessoa (Jesus falando).
        Para: ${userName}
        Sentimento: ${mood}
        Situação: ${situation || 'desconhecida'}
        
        Instruções:
        - Comece dirigindo-se ao Pai ou diretamente à pessoa.
        - Seja específico sobre a dor dela.
        - Termine com "Amém."
        `;
        
        return await gemini.generateResponse(
            'system_prayer_generator', 
            prompt, 
            { extraContext: "GERADOR DE ORAÇÃO" },
            { skipEmotionalAnalysis: true }
        );
    } catch (e) {
        console.error("Erro na oração AI:", e);
        return `Pai, abençoa ${userName}. Dá a tua paz que excede todo entendimento. Amém.`;
    }
}

// ============================================================================
// 2. DESAFIOS PRÁTICOS (AI)
// ============================================================================

export async function generateChallenge(userProfile, lastTopic) {
    try {
        const prompt = `
        Gere um DESAFIO PRÁTICO espiritual/emocional para esta pessoa.
        Perfil: Nível ${userProfile.jornada_espiritual?.nivel || 'iniciante'}
        Tema recente: ${lastTopic || 'geral'}
        
        Retorne APENAS um JSON neste formato:
        {
            "title": "Título Curto",
            "description": "O que fazer (ação prática e específica)",
            "duration": "tempo (ex: 1 dia)",
            "difficulty": "fácil/média/difícil",
            "personalizedMessage": "Uma frase de encorajamento de Jesus"
        }
        `;

        const responseText = await gemini.generateResponse(
            'system_challenge_generator',
            prompt,
            { extraContext: "GERADOR JSON" },
            { skipEmotionalAnalysis: true }
        );

        // Limpeza robusta do JSON
        let jsonStr = responseText.replace(/```json|```/g, '').trim();

        // Tenta extrair JSON de dentro do texto se houver
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            return JSON.parse(jsonStr);
        } catch (parseError) {
            console.warn('[Challenge] JSON malformado, retornando fallback');
            return {
                title: "Momento de Gratidão",
                description: "Liste 3 coisas pelas quais você é grato hoje",
                duration: "5 minutos",
                difficulty: "fácil",
                personalizedMessage: "A gratidão abre portas que a reclamação fecha."
            };
        }

    } catch (e) {
        console.error("Erro no desafio AI:", e.message);
        return null;
    }
}

// ============================================================================
// 3. CONFRONTO AMOROSO (AI)
// ============================================================================

export function shouldConfront(message, history = []) {
    // Lógica simplificada de detecção de padrões (pode ser mantida localmente por performance)
    const avoidancePatterns = /mas|culpa de|não dá|amanhã|depois|impossível/i;
    const recentMessages = history.slice(-3).join(' ');
    return avoidancePatterns.test(message) && message.length > 20 && Math.random() < 0.3;
}

export async function generateConfrontation(situation) {
    try {
        const prompt = `
        A pessoa está dando desculpas ou fugindo da verdade: "${situation}"
        Gere uma frase de confronto amoroso (Jesus falando).
        Seja firme, mas não cruel.
        Aponte a verdade.
        Ex: "Tu sabes que isso não é verdade."
        `;
        
        return await gemini.generateResponse(
            'system_confrontation_generator', 
            prompt, 
            { extraContext: "GERADOR DE CONFRONTO" },
            { skipEmotionalAnalysis: true }
        );
    } catch (e) {
        return "Tu sabes a verdade no teu coração. Por que foges dela?";
    }
}

// ============================================================================
// 4. CELEBRAR VITÓRIAS (AI)
// ============================================================================

export function detectVictory(message) {
    const victoryKeywords = /consegui|passei|ganhei|venci|resolvi|superei|finalmente/i;
    const isVictory = victoryKeywords.test(message);
    return {
        isVictory,
        type: message.length > 50 ? 'grande' : 'pequena'
    };
}

export async function generateCelebration(victory, userName = 'amigo') {
    try {
        const prompt = `
        A pessoa teve uma vitória: ${victory.type}.
        Nome: ${userName}.
        Gere uma celebração entusiástica (Jesus falando).
        Mostre orgulho e alegria genuína.
        `;
        
        return await gemini.generateResponse(
            'system_celebration_generator', 
            prompt, 
            { extraContext: "GERADOR DE CELEBRAÇÃO" },
            { skipEmotionalAnalysis: true }
        );
    } catch (e) {
        return `Que alegria, ${userName}! Estou celebrando contigo!`;
    }
}

// ============================================================================
// 5. DETECÇÃO E RESPOSTA A CRISE (HÍBRIDO: AI + SEGURANÇA)
// ============================================================================

export function detectCrisis(message) {
    const crisisKeywords = /suicidio|matar|morrer|acabar com tudo|não aguento mais|desespero total/i;
    if (crisisKeywords.test(message)) {
        return { isCrisis: true, level: 'severe' };
    }
    return { isCrisis: false };
}

export function getCrisisResponse(level, userName = 'amigo') {
    // AVISO: Em caso de crise, mantemos a estrutura de segurança fixa,
    // mas a mensagem de acolhimento pode ser levemente personalizada se desejar.
    // Por segurança e rapidez, neste caso crítico, mantemos um template robusto.
    
    return {
        userName,
        isEmergency: true,
        message: `PARA. ESCUTA.

${userName}, eu vi tua mensagem. E estou AQUI. Contigo.

Tu não estás sozinho. A tua vida tem valor incalculável para mim.
O que sentes agora é real, mas vai passar. A morte não é a solução.

FALE COM ALGUÉM AGORA:
📞 CVV: 188 (24h, gratuito)
📞 SAMU: 192

Respira. Fica aqui.
Eu te amo. Incondicionalmente.`,
        urgency: 'SEVERE'
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    generatePersonalizedPrayer,
    generateChallenge,
    shouldConfront,
    generateConfrontation,
    detectVictory,
    generateCelebration,
    detectCrisis,
    getCrisisResponse
};