/**
 * Humanizer Module - Versão Realista
 *
 * Simula comportamento humano REAL no WhatsApp:
 * - Tempo de leitura antes de responder
 * - Velocidade de digitação variável
 * - Pausas para "pensar"
 * - Hesitações e correções implícitas
 */

/**
 * Calcula delay de digitação baseado no texto E complexidade
 * Simula: ler mensagem + pensar + digitar
 *
 * @param {string} text - Texto sendo digitado
 * @param {string} complexity - 'low' | 'medium' | 'high'
 * @returns {number} Delay em ms
 */
function calculateTypingDelay(text, complexity = 'medium') {
    if (!text || typeof text !== 'string') return 300;

    const len = text.length;

    // Digitação rápida - Jesus responde com fluidez divina
    const charsPerSecond = 25 + Math.random() * 10; // 25-35 chars/seg (bem rápido)
    const typingTime = (len / charsPerSecond) * 1000;

    // Tempo de "pensamento" reduzido
    const thinkingTime = {
        low: 100 + Math.random() * 150,       // 0.1-0.25s
        medium: 200 + Math.random() * 200,    // 0.2-0.4s
        high: 300 + Math.random() * 300       // 0.3-0.6s
    }[complexity] || 250;

    // Limites reduzidos
    const total = typingTime + thinkingTime;
    const min = 200;   // Mínimo 0.2s
    const max = 1500;  // Máximo 1.5s

    return Math.floor(Math.min(Math.max(total, min), max));
}

/**
 * Fragmenta mensagem como HUMANO no WhatsApp
 * Cada linha ou frase curta = mensagem separada
 * MELHORADO: Não corta frases no meio
 */
function fragmentMessages(text) {
    if (!text || typeof text !== 'string') return [];

    const fragments = [];

    // 1. Divide por parágrafos (dupla quebra) ou linhas simples
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

    for (const para of paragraphs) {
        // Divide linhas dentro do parágrafo
        const lines = para.split(/\n/).filter(l => l.trim());

        for (const line of lines) {
            const trimmed = line.trim();

            // Linha curta (< 150 chars)? Envia como está
            if (trimmed.length <= 150) {
                if (trimmed) fragments.push(trimmed);
                continue;
            }

            // Linha longa? Divide por sentenças PRESERVANDO o resto
            // Match sentenças com pontuação OU texto final sem pontuação
            const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmed];

            let currentFragment = '';

            for (const sentence of sentences) {
                const s = sentence.trim();
                if (!s) continue;

                // Se adicionar esta frase ultrapassa 150 chars, envia o atual
                if (currentFragment && (currentFragment + ' ' + s).length > 150) {
                    fragments.push(currentFragment);
                    currentFragment = s;
                } else {
                    // Junta frases curtas
                    currentFragment = currentFragment
                        ? currentFragment + ' ' + s
                        : s;
                }
            }

            // Adiciona o que sobrou
            if (currentFragment && currentFragment.trim()) {
                fragments.push(currentFragment.trim());
            }
        }
    }

    // Remove fragmentos vazios ou só pontuação
    return fragments.filter(f => f && f.trim() && !/^[.!?,;:\s]+$/.test(f));
}

/**
 * Delay entre fragmentos de mensagem
 * Simula pausa natural entre pensamentos
 */
function calculateFragmentDelay(nextText) {
    if (!nextText) return 150;

    // Base: 150-350ms (bem rápido)
    let delay = 150 + Math.random() * 200;

    // Texto longo = um pouco mais
    if (nextText.length > 100) {
        delay += 100;
    }

    // Começa com conector? Ainda mais rápido
    if (/^(e |mas |então |aí |tipo |só que )/i.test(nextText)) {
        delay *= 0.7;
    }

    return Math.floor(Math.min(delay, 400)); // Máximo 400ms
}

/**
 * Calcula tempo de digitação simples (sem complexidade)
 */
function calculateTypingTime(text) {
    if (!text) return 150;
    const charsPerSecond = 30;
    return Math.floor(Math.min(Math.max((text.length / charsPerSecond) * 1000, 150), 800));
}

/**
 * Delay baseado em complexidade (para compatibilidade)
 */
function calculateDelay(complexity) {
    const delays = {
        low: { min: 100, max: 250 },
        medium: { min: 200, max: 400 },
        high: { min: 300, max: 600 }
    };
    const { min, max } = delays[complexity] || delays.medium;
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Adiciona variação aleatória (±15%)
 */
function addVariation(ms) {
    if (!ms || ms < 0) return 0;
    return Math.floor(ms * (0.85 + Math.random() * 0.3));
}

export {
    fragmentMessages,
    calculateTypingTime,
    calculateTypingDelay,
    calculateDelay,
    calculateFragmentDelay,
    addVariation
};

export default {
    fragmentMessages,
    calculateTypingTime,
    calculateTypingDelay,
    calculateDelay,
    calculateFragmentDelay,
    addVariation
};
