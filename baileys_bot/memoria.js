/**
 * Sistema de Memória para Jesus Bot
 * Gerencia extração de informações, detecção de humor e contexto
 */

// ═══════════════════════════════════════════════════════════════
// EXTRAÇÃO DE INFORMAÇÕES
// ═══════════════════════════════════════════════════════════════

/**
 * Extrai informações relevantes de uma mensagem do usuário
 * @param {string} mensagem - Mensagem recebida do usuário
 * @param {Object} perfilAtual - Perfil atual do usuário
 * @returns {Object} Informações extraídas (nome, família, trabalho, sentimentos)
 */
export function extractInfo(mensagem, perfilAtual = {}) {
    const info = {
        nome: perfilAtual.nome || null,
        familia: perfilAtual.familia || [],
        trabalho: perfilAtual.trabalho || null,
        sentimentos: perfilAtual.sentimentos || [],
        hobbies: perfilAtual.hobbies || [],
        localizacao: perfilAtual.localizacao || null
    };

    const msgLower = mensagem.toLowerCase();

    // Extração de nome
    const nomePatterns = [
        /(?:meu nome (?:é|e)|me chamo|sou o|sou a|eu sou)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        /^(?:oi|olá|ola),?\s+(?:sou|eu sou)\s+(?:o|a)?\s*([a-záàâãéèêíïóôõöúçñ]+)/i
    ];
    for (const pattern of nomePatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.nome = match[1].trim();
            break;
        }
    }

    // Extração de família
    const familiaKeywords = {
        esposa: /(?:minha esposa|minha mulher|esposa|mulher)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        marido: /(?:meu marido|marido)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        filho: /(?:meu filho|filho|meus filhos|filhos)(?:\s+(?:se chama|é|chama|são))?\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        filha: /(?:minha filha|filha|minhas filhas|filhas)(?:\s+(?:se chama|é|chama|são))?\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        mae: /(?:minha mãe|minha mae|mãe|mae)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        pai: /(?:meu pai|pai)\s+(?:se chama|é|chama)\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
        irmao: /(?:meu irmão|meu irmao|irmão|irmao|irmãos|irmaos)\s+(?:se chama|é|chama|são)\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i,
        irma: /(?:minha irmã|minha irma|irmã|irma|irmãs|irmas)\s+(?:se chama|é|chama|são)\s+([a-záàâãéèêíïóôõöúçñ\s,e]+)/i
    };

    for (const [tipo, pattern] of Object.entries(familiaKeywords)) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            const nomes = match[1].split(/,|\se\s/).map(n => n.trim());
            nomes.forEach(nome => {
                if (nome.length > 1) {
                    info.familia.push({ tipo, nome });
                }
            });
        }
    }

    // Extração de trabalho
    const trabalhoPatterns = [
        /(?:trabalho como|sou|atuo como|profissão|trabalho de)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|no|na|em|$)/i,
        /(?:trabalho|emprego)\s+(?:na|no|em)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|como|$)/i
    ];
    for (const pattern of trabalhoPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.trabalho = match[1].trim();
            break;
        }
    }

    // Extração de sentimentos e emoções
    const sentimentoKeywords = {
        tristeza: ['triste', 'deprimido', 'depressão', 'melancolia', 'sozinho', 'vazio', 'perdido'],
        ansiedade: ['ansioso', 'ansiedade', 'preocupado', 'nervoso', 'estresse', 'estressado', 'angústia', 'angustiado'],
        alegria: ['feliz', 'alegre', 'contente', 'grato', 'abençoado', 'radiante', 'animado'],
        medo: ['medo', 'com medo', 'assustado', 'receio', 'temor', 'pavor'],
        raiva: ['raiva', 'irritado', 'com raiva', 'bravo', 'furioso', 'indignado'],
        esperanca: ['esperança', 'esperançoso', 'confiante', 'otimista', 'fé'],
        dor: ['dor', 'sofrimento', 'sofrendo', 'machucado', 'ferido', 'doente'],
        confusao: ['confuso', 'perdido', 'sem rumo', 'desorientado', 'não sei'],
        desespero: ['desespero', 'desesperado', 'sem saída', 'não aguento', 'fim', 'acabou']
    };

    for (const [sentimento, keywords] of Object.entries(sentimentoKeywords)) {
        for (const keyword of keywords) {
            if (msgLower.includes(keyword)) {
                if (!info.sentimentos.includes(sentimento)) {
                    info.sentimentos.push(sentimento);
                }
            }
        }
    }

    // Extração de hobbies e interesses
    const hobbiesPatterns = [
        /(?:gosto de|amo|adoro|curto)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|e|$)/i,
        /(?:hobby|hobbies|paixão|interesse)\s+(?:é|são|por)?\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|e|$)/i
    ];
    for (const pattern of hobbiesPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            const hobby = match[1].trim();
            if (hobby.length > 2 && !info.hobbies.includes(hobby)) {
                info.hobbies.push(hobby);
            }
        }
    }

    // Extração de localização
    const localizacaoPatterns = [
        /(?:moro em|vivo em|sou de|da cidade de|da)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|$)/i,
        /(?:aqui em|aqui no|aqui na)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:\.|,|$)/i
    ];
    for (const pattern of localizacaoPatterns) {
        const match = mensagem.match(pattern);
        if (match && match[1]) {
            info.localizacao = match[1].trim();
            break;
        }
    }

    return info;
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUÇÃO DE CONTEXTO
// ═══════════════════════════════════════════════════════════════

/**
 * Constrói contexto personalizado para o Gemini baseado no perfil do usuário
 * @param {Object} perfil - Perfil do usuário com informações coletadas
 * @returns {string} Contexto formatado para o Gemini
 */
export function buildContext(perfil) {
    const partes = [];

    if (perfil.nome) {
        partes.push(`Nome: ${perfil.nome}`);
    }

    if (perfil.familia && perfil.familia.length > 0) {
        const familiaTexto = perfil.familia
            .map(f => `${f.tipo}: ${f.nome}`)
            .join(', ');
        partes.push(`Família: ${familiaTexto}`);
    }

    if (perfil.trabalho) {
        partes.push(`Trabalho: ${perfil.trabalho}`);
    }

    if (perfil.localizacao) {
        partes.push(`Localização: ${perfil.localizacao}`);
    }

    if (perfil.hobbies && perfil.hobbies.length > 0) {
        partes.push(`Interesses: ${perfil.hobbies.join(', ')}`);
    }

    if (perfil.sentimentos && perfil.sentimentos.length > 0) {
        partes.push(`Estado emocional atual: ${perfil.sentimentos.join(', ')}`);
    }

    if (perfil.ultimoContato) {
        const diasDesde = Math.floor((Date.now() - perfil.ultimoContato) / (1000 * 60 * 60 * 24));
        if (diasDesde > 0) {
            partes.push(`Último contato: há ${diasDesde} dia${diasDesde > 1 ? 's' : ''}`);
        }
    }

    if (perfil.frequenciaContato) {
        partes.push(`Frequência de contato: ${perfil.frequenciaContato}`);
    }

    if (partes.length === 0) {
        return '';
    }

    return `\n\n[CONTEXTO DO FILHO(A)]:\n${partes.join('\n')}\n`;
}

// ═══════════════════════════════════════════════════════════════
// DETECÇÃO DE HUMOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta o humor predominante da mensagem
 * @param {string} mensagem - Mensagem do usuário
 * @returns {string} Humor detectado (triste, ansioso, feliz, neutro, desesperado, etc)
 */
export function detectMood(mensagem) {
    const msgLower = mensagem.toLowerCase();

    // Pontuação por categoria de humor
    const scores = {
        desesperado: 0,
        triste: 0,
        ansioso: 0,
        feliz: 0,
        grato: 0,
        confuso: 0,
        com_medo: 0,
        irritado: 0
    };

    // Palavras e padrões para cada humor
    const padroes = {
        desesperado: {
            palavras: ['desespero', 'desesperado', 'sem saída', 'não aguento mais', 'quero morrer',
                      'acabou', 'perdido tudo', 'não vejo solução', 'sem esperança'],
            peso: 3
        },
        triste: {
            palavras: ['triste', 'tristeza', 'deprimido', 'depressão', 'choro', 'chorando',
                      'sozinho', 'solidão', 'vazio', 'melancolia', 'luto'],
            peso: 2
        },
        ansioso: {
            palavras: ['ansioso', 'ansiedade', 'preocupado', 'preocupação', 'nervoso',
                      'estresse', 'estressado', 'angústia', 'não consigo parar de pensar'],
            peso: 2
        },
        feliz: {
            palavras: ['feliz', 'alegre', 'alegria', 'contente', 'animado', 'radiante',
                      'maravilhoso', 'ótimo', 'excelente', 'melhor'],
            peso: 2
        },
        grato: {
            palavras: ['grato', 'gratidão', 'agradeço', 'obrigado', 'abençoado', 'grata',
                      'reconhecido', 'louvado seja'],
            peso: 2
        },
        confuso: {
            palavras: ['confuso', 'confusão', 'perdido', 'não sei', 'dúvida', 'incerto',
                      'desorientado', 'sem rumo'],
            peso: 1.5
        },
        com_medo: {
            palavras: ['medo', 'com medo', 'assustado', 'receio', 'temor', 'pavor',
                      'apavorado', 'aterrorizado'],
            peso: 2
        },
        irritado: {
            palavras: ['raiva', 'irritado', 'com raiva', 'bravo', 'furioso', 'indignado',
                      'revoltado', 'ódio'],
            peso: 2
        }
    };

    // Calcula pontuação para cada humor
    for (const [humor, config] of Object.entries(padroes)) {
        for (const palavra of config.palavras) {
            if (msgLower.includes(palavra)) {
                scores[humor] += config.peso;
            }
        }
    }

    // Detecta pontuação excessiva (!!!, ???) - indica emoção intensa
    const exclamacoes = (mensagem.match(/!{2,}/g) || []).length;
    const interrogacoes = (mensagem.match(/\?{2,}/g) || []).length;

    if (exclamacoes > 0) {
        if (scores.feliz > 0) scores.feliz += exclamacoes;
        if (scores.desesperado > 0) scores.desesperado += exclamacoes;
        if (scores.irritado > 0) scores.irritado += exclamacoes;
    }

    if (interrogacoes > 0) {
        if (scores.confuso > 0) scores.confuso += interrogacoes;
        if (scores.ansioso > 0) scores.ansioso += interrogacoes;
    }

    // Encontra o humor predominante
    let humorPredominante = 'neutro';
    let maxScore = 0;

    for (const [humor, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            humorPredominante = humor;
        }
    }

    return humorPredominante;
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE FOLLOW-UP
// ═══════════════════════════════════════════════════════════════

/**
 * Determina se deve agendar um follow-up com o usuário
 * @param {Object} perfil - Perfil do usuário
 * @param {string} resposta - Resposta que será enviada
 * @returns {boolean} true se deve agendar follow-up
 */
export function shouldFollowUp(perfil, resposta) {
    // Situações que exigem follow-up
    const condicoesFollowUp = {
        // Humor crítico
        humorCritico: perfil.sentimentos &&
                      (perfil.sentimentos.includes('desespero') ||
                       perfil.sentimentos.includes('dor')),

        // Oração ou bênção enviada
        oracaoEnviada: resposta &&
                       (resposta.toLowerCase().includes('orarei') ||
                        resposta.toLowerCase().includes('abençoo') ||
                        resposta.toLowerCase().includes('benção')),

        // Primeiro contato ou retorno após longo período
        primeiroContato: !perfil.ultimoContato,

        retornoLongo: perfil.ultimoContato &&
                      (Date.now() - perfil.ultimoContato) > (7 * 24 * 60 * 60 * 1000), // 7 dias

        // Pedido de ajuda específica
        pedidoAjuda: perfil.ultimaPergunta &&
                     (perfil.ultimaPergunta.includes('me ajude') ||
                      perfil.ultimaPergunta.includes('preciso de ajuda'))
    };

    // Retorna true se alguma condição for verdadeira
    return Object.values(condicoesFollowUp).some(condicao => condicao === true);
}

/**
 * Sugere horário ideal para follow-up baseado no padrão do usuário
 * @param {Object} perfil - Perfil do usuário com histórico de horários
 * @returns {Date} Data/hora sugerida para follow-up
 */
export function suggestFollowUpTime(perfil) {
    const agora = new Date();

    // Se temos histórico de horários, calcula média
    if (perfil.horariosContato && perfil.horariosContato.length > 0) {
        // Calcula hora média do dia
        const horasMedias = perfil.horariosContato.reduce((acc, h) => acc + h, 0) / perfil.horariosContato.length;

        // Agenda para amanhã no horário médio
        const followUp = new Date(agora);
        followUp.setDate(followUp.getDate() + 1);
        followUp.setHours(Math.floor(horasMedias), 0, 0, 0);

        return followUp;
    }

    // Se não temos histórico, agenda para 24h depois no mesmo horário
    const followUp = new Date(agora);
    followUp.setDate(followUp.getDate() + 1);

    return followUp;
}

// ═══════════════════════════════════════════════════════════════
// ANÁLISE DE FREQUÊNCIA
// ═══════════════════════════════════════════════════════════════

/**
 * Analisa a frequência de contato do usuário
 * @param {Array} historicoContatos - Array de timestamps dos contatos
 * @returns {string} Classificação da frequência (diária, semanal, mensal, esporádica)
 */
export function analyzeContactFrequency(historicoContatos) {
    if (!historicoContatos || historicoContatos.length < 2) {
        return 'primeira_vez';
    }

    // Calcula intervalo médio entre contatos
    const intervalos = [];
    for (let i = 1; i < historicoContatos.length; i++) {
        const intervalo = historicoContatos[i] - historicoContatos[i - 1];
        intervalos.push(intervalo);
    }

    const intervaloMedio = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
    const diasMedio = intervaloMedio / (1000 * 60 * 60 * 24);

    // Classifica frequência
    if (diasMedio <= 1.5) return 'diária';
    if (diasMedio <= 7) return 'semanal';
    if (diasMedio <= 30) return 'mensal';
    return 'esporádica';
}

/**
 * Registra horário de contato para análise de padrões
 * @param {Object} perfil - Perfil do usuário
 * @returns {Object} Perfil atualizado com novo horário
 */
export function registrarHorarioContato(perfil) {
    const agora = new Date();
    const hora = agora.getHours();

    if (!perfil.horariosContato) {
        perfil.horariosContato = [];
    }

    perfil.horariosContato.push(hora);

    // Mantém apenas os últimos 30 registros
    if (perfil.horariosContato.length > 30) {
        perfil.horariosContato = perfil.horariosContato.slice(-30);
    }

    return perfil;
}
