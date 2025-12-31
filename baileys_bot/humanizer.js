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
    if (!text || typeof text !== 'string') return 1000;

    const len = text.length;

    // 1. Tempo base de digitação (humano digita ~40-60 chars/min em mobile)
    //    Isso dá ~1 char a cada 1-1.5 segundos, mas vamos ser mais rápidos
    //    pois "Jesus" digitaria com mais fluidez
    const charsPerSecond = 8 + Math.random() * 4; // 8-12 chars/seg
    const typingTime = (len / charsPerSecond) * 1000;

    // 2. Tempo de "pensamento" baseado na complexidade
    const thinkingTime = {
        low: 500 + Math.random() * 500,      // 0.5-1s - resposta simples
        medium: 1000 + Math.random() * 1500,  // 1-2.5s - precisa pensar
        high: 2000 + Math.random() * 2000     // 2-4s - resposta profunda
    }[complexity] || 1500;

    // 3. Micro-pausas aleatórias (simula hesitação)
    const microPauses = Math.floor(len / 50) * (200 + Math.random() * 300);

    // 4. Limites min/max para não ser absurdo
    const total = typingTime + thinkingTime + microPauses;
    const min = 800;   // Mínimo 0.8s
    const max = 8000;  // Máximo 8s

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
    if (!nextText) return 800;

    // Base: 0.8 a 2 segundos
    let delay = 800 + Math.random() * 1200;

    // Texto longo = mais tempo pra "formular"
    if (nextText.length > 100) {
        delay += 500 + Math.random() * 500;
    }

    // Começa com conector? Delay menor (fluxo contínuo)
    if (/^(e |mas |então |aí |tipo |só que )/i.test(nextText)) {
        delay *= 0.6;
    }

    // Começa com pergunta? Delay maior (mudança de tom)
    if (/^(o que|por que|como|quando|você|quer|pode)/i.test(nextText)) {
        delay += 300;
    }

    return Math.floor(delay);
}

/**
 * Calcula tempo de digitação simples (sem complexidade)
 */
function calculateTypingTime(text) {
    if (!text) return 500;
    const charsPerSecond = 10;
    return Math.floor(Math.min(Math.max((text.length / charsPerSecond) * 1000, 500), 5000));
}

/**
 * Delay baseado em complexidade (para compatibilidade)
 */
function calculateDelay(complexity) {
    const delays = {
        low: { min: 500, max: 1500 },
        medium: { min: 1500, max: 3000 },
        high: { min: 3000, max: 5000 }
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
