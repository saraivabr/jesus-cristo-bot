import cron from 'node-cron';
import {
    getUsuario,
    addAgendamento,
    getAgendamentosPendentes,
    marcarAgendamentoEnviado,
    getHistorico,
    updateUsuario,
    db
} from './database.js';
import config from './config.js';
import { detectMood } from './memoria.js';

// ═══════════════════════════════════════════════════════════════
// FUNCOES HELPER DE RESILIENCIA
// ═══════════════════════════════════════════════════════════════

/**
 * Parse JSON de forma segura
 * @param {string} str - String JSON
 * @param {any} fallback - Valor padrão se falhar
 * @returns {any}
 */
function safeParseSchedulerJson(str, fallback = []) {
    if (!str || str === 'null' || str === 'undefined') return fallback;
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
        if (typeof fallback === 'object' && !Array.isArray(fallback) && typeof parsed !== 'object') return fallback;
        return parsed;
    } catch (e) {
        console.warn('[Scheduler] JSON inválido:', String(str).substring(0, 50));
        return fallback;
    }
}

/**
 * Parse de data seguro
 * @param {string} dateStr - String de data
 * @returns {Date|null}
 */
function safeParseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        console.warn('[Scheduler] Data inválida:', dateStr);
        return null;
    }
    return date;
}

/**
 * Envia mensagem com retry e backoff exponencial
 * @param {string} phone - Telefone do destinatário
 * @param {string} message - Mensagem a enviar
 * @param {number} maxRetries - Número máximo de tentativas
 * @returns {Promise<{success: boolean, attempts: number}>}
 */
async function sendWithRetry(phone, message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sendMessageFunction(phone, message);
            return { success: true, attempts: attempt };
        } catch (error) {
            console.error(`[Scheduler] Tentativa ${attempt}/${maxRetries} falhou:`, error.message);

            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    return { success: false, attempts: maxRetries };
}

const CHECK_INTERVAL_MS = (config?.SCHEDULER_CONFIG?.checkInterval) || 60000;
const TIMEZONE = (config?.SCHEDULER_CONFIG?.timezone) || 'America/Sao_Paulo';

// Store active cron jobs
const cronJobs = new Map();
let sendMessageFunction = null;
let isInitialized = false;
let nudgeTimeout = null;

// ═══════════════════════════════════════════════════════════════
// MIGRACAO DO BANCO DE DADOS
// ═══════════════════════════════════════════════════════════════

/**
 * Executa migrações necessárias para o scheduler avançado
 */
function runMigrations() {
    // Adiciona colunas para controle avançado de agendamentos
    const migrations = [
        // Colunas na tabela usuarios
        `ALTER TABLE usuarios ADD COLUMN aniversario TEXT`,
        `ALTER TABLE usuarios ADD COLUMN primeira_conversa TEXT`,
        `ALTER TABLE usuarios ADD COLUMN versiculo_diario_ativo INTEGER DEFAULT 0`,
        `ALTER TABLE usuarios ADD COLUMN horario_versiculo TEXT DEFAULT '07:00'`,
        `ALTER TABLE usuarios ADD COLUMN ultimo_assunto TEXT`,
        `ALTER TABLE usuarios ADD COLUMN datas_especiais TEXT DEFAULT '[]'`,
        `ALTER TABLE usuarios ADD COLUMN horarios_mensagens TEXT DEFAULT '[]'`,

        // Colunas na tabela agendamentos
        `ALTER TABLE agendamentos ADD COLUMN tentativas INTEGER DEFAULT 0`,
        `ALTER TABLE agendamentos ADD COLUMN max_tentativas INTEGER DEFAULT 3`,
        `ALTER TABLE agendamentos ADD COLUMN respondido INTEGER DEFAULT 0`,
        `ALTER TABLE agendamentos ADD COLUMN contexto TEXT`,
        `ALTER TABLE agendamentos ADD COLUMN subtipo TEXT`
    ];

    for (const migration of migrations) {
        try {
            db.exec(migration);
        } catch (e) {
            // Coluna já existe, ignorar
        }
    }

    // Criar índices adicionais
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_agendamentos_tipo ON agendamentos(tipo)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_usuarios_versiculo ON usuarios(versiculo_diario_ativo)`);
    } catch (e) {
        // Índices já existem
    }
}

// Executar migrações ao carregar o módulo
runMigrations();

// ═══════════════════════════════════════════════════════════════
// VERSICULOS DO DIA
// ═══════════════════════════════════════════════════════════════

const VERSICULOS = [
    { texto: "O Senhor é meu pastor e nada me faltará.", referencia: "Salmos 23:1" },
    { texto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", referencia: "João 3:16" },
    { texto: "Tudo posso naquele que me fortalece.", referencia: "Filipenses 4:13" },
    { texto: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", referencia: "Salmos 37:5" },
    { texto: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.", referencia: "Isaías 41:10" },
    { texto: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", referencia: "Mateus 11:28" },
    { texto: "E conhecereis a verdade, e a verdade vos libertará.", referencia: "João 8:32" },
    { texto: "O Senhor é a minha luz e a minha salvação; a quem temerei?", referencia: "Salmos 27:1" },
    { texto: "Busquem o Reino de Deus acima de tudo, e vivam de maneira justa, e ele lhes dará tudo o que precisarem.", referencia: "Mateus 6:33" },
    { texto: "Eu sou o caminho, a verdade e a vida. Ninguém vem ao Pai senão por mim.", referencia: "João 14:6" },
    { texto: "Mas buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.", referencia: "Mateus 6:33" },
    { texto: "E eis que estou convosco todos os dias, até a consumação dos séculos.", referencia: "Mateus 28:20" },
    { texto: "Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo.", referencia: "Salmos 23:4" },
    { texto: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", referencia: "1 Coríntios 13:4" },
    { texto: "Porque onde estiver o vosso tesouro, aí estará também o vosso coração.", referencia: "Mateus 6:21" },
    { texto: "Bem-aventurados os misericordiosos, porque eles alcançarão misericórdia.", referencia: "Mateus 5:7" },
    { texto: "Pedi, e dar-se-vos-á; buscai, e encontrareis; batei, e abrir-se-vos-á.", referencia: "Mateus 7:7" },
    { texto: "Se Deus é por nós, quem será contra nós?", referencia: "Romanos 8:31" },
    { texto: "O fruto do Espírito é amor, alegria, paz, paciência, amabilidade, bondade, fidelidade, mansidão e domínio próprio.", referencia: "Gálatas 5:22-23" },
    { texto: "Lança o teu cuidado sobre o Senhor, e ele te susterá.", referencia: "Salmos 55:22" },
    { texto: "Dá-me entendimento, e guardarei a tua lei; de todo o coração a cumprirei.", referencia: "Salmos 119:34" },
    { texto: "Ora, a fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.", referencia: "Hebreus 11:1" },
    { texto: "Alegrai-vos sempre. Orai sem cessar.", referencia: "1 Tessalonicenses 5:16-17" },
    { texto: "Porque os que são segundo a carne inclinam-se para as coisas da carne; mas os que são segundo o Espírito para as coisas do Espírito.", referencia: "Romanos 8:5" },
    { texto: "Confiai no Senhor perpetuamente; porque o Senhor Deus é uma rocha eterna.", referencia: "Isaías 26:4" },
    { texto: "E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos pensamentos em Cristo Jesus.", referencia: "Filipenses 4:7" },
    { texto: "Eu vim para que tenham vida, e a tenham com abundância.", referencia: "João 10:10" },
    { texto: "Portanto, não vos inquieteis com o dia de amanhã, pois o amanhã trará os seus cuidados.", referencia: "Mateus 6:34" },
    { texto: "O Senhor é bom, é fortaleza no dia da angústia, e conhece os que nele confiam.", referencia: "Naum 1:7" },
    { texto: "Porque onde dois ou três estiverem reunidos em meu nome, ali estou no meio deles.", referencia: "Mateus 18:20" }
];

// ═══════════════════════════════════════════════════════════════
// VERSICULOS MATINAIS (6:30-8:00 AM)
// ═══════════════════════════════════════════════════════════════

const VERSICULOS_MANHA = [
    { texto: "Este é o dia que o Senhor fez; regozijemo-nos e alegremo-nos nele.", referencia: "Salmos 118:24", temas: ["alegria", "renovação"] },
    { texto: "O Senhor é meu pastor e nada me faltará.", referencia: "Salmos 23:1", temas: ["confiança", "proteção"] },
    { texto: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.", referencia: "Isaías 41:10", temas: ["coragem", "segurança"] },
    { texto: "Digno é o Cordeiro que foi morto de receber o poder, e riqueza, e sabedoria, e força, e honra, e glória, e louvor.", referencia: "Apocalipse 5:12", temas: ["adoração", "louvor"] },
    { texto: "A alegria do Senhor é a vossa força.", referencia: "Neemias 8:10", temas: ["alegria", "força"] },
    { texto: "Eu posso fazer todas as coisas por meio daquele que me fortalece.", referencia: "Filipenses 4:13", temas: ["força", "capacidade"] },
    { texto: "Buscai a face do Senhor continuamente.", referencia: "Salmos 105:4", temas: ["devoção", "busca"] },
    { texto: "O Senhor é a minha luz e a minha salvação; a quem temerei?", referencia: "Salmos 27:1", temas: ["esperança", "proteção"] },
    { texto: "Bendize, minha alma, ao Senhor, e não te esqueças de nenhuma de seus benefícios.", referencia: "Salmos 103:2", temas: ["gratidão", "bênçãos"] },
    { texto: "Porque para mim o viver é Cristo, e o morrer é ganho.", referencia: "Filipenses 1:21", temas: ["propósito", "fé"] },
    { texto: "Todo aquele que crer em mim, ainda que esteja morto, viverá.", referencia: "João 11:25", temas: ["esperança", "vida eterna"] },
    { texto: "Em todas as coisas damos graças; porque esta é a vontade de Deus em Cristo Jesus para convosco.", referencia: "1 Tessalonicenses 5:18", temas: ["gratidão", "ação de graças"] },
    { texto: "Porque a esperança não nos envergonha, porquanto o amor de Deus está derramado em nossos corações.", referencia: "Romanos 5:5", temas: ["esperança", "amor"] },
    { texto: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", referencia: "Mateus 11:28", temas: ["descanso", "repouso"] },
    { texto: "Levantem-se, não desmaiem, pois sua obra será recompensada.", referencia: "2 Crônicas 15:7", temas: ["ânimo", "recompensa"] },
    { texto: "O Senhor está próximo de todos os que o invocam, de todos os que o invocam em verdade.", referencia: "Salmos 145:18", temas: ["proximidade", "verdade"] },
    { texto: "Graças ao Senhor, porque é bom, porque a sua misericórdia dura para sempre.", referencia: "Salmos 118:1", temas: ["gratidão", "misericórdia"] },
    { texto: "Pois Deus não nos deu espírito de covardia, mas de poder, de amor e de moderação.", referencia: "2 Timóteo 1:7", temas: ["poder", "amor", "sabedoria"] },
    { texto: "Deita sobre o Senhor as tuas preocupações, porque ele tem cuidado de ti.", referencia: "1 Pedro 5:7", temas: ["confiança", "cuidado"] },
    { texto: "Porque aos seus amigos concede o Senhor sono tranquilo.", referencia: "Salmos 127:2", temas: ["repouso", "paz"] },
    { texto: "O temor do Senhor é o princípio da sabedoria; e o conhecimento do Santo é entendimento.", referencia: "Provérbios 9:10", temas: ["sabedoria", "conhecimento"] },
    { texto: "Bem-aventurados os que confiam no Senhor, pois o Senhor será a sua segurança.", referencia: "Provérbios 29:25", temas: ["felicidade", "segurança"] },
    { texto: "Envio-vos como ovelhas no meio de lobos; sede portanto prudentes como as serpentes e simples como as pombas.", referencia: "Mateus 10:16", temas: ["sabedoria", "discernimento"] },
    { texto: "Porque somos feitura de Deus, criados em Cristo Jesus para fazer boas obras.", referencia: "Efésios 2:10", temas: ["propósito", "obras"] },
    { texto: "Qualquer coisa que pedirdes em oração, crendo, recebereis.", referencia: "Mateus 21:22", temas: ["fé", "oração"] },
    { texto: "Porque Deus tanto amou o mundo que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", referencia: "João 3:16", temas: ["amor", "vida eterna"] }
];

// ═══════════════════════════════════════════════════════════════
// 2. VERSICULO DO DIA (6:30-8:00 AM COM VARIACAO)
// ═══════════════════════════════════════════════════════════════

/**
 * Envia versículo da manhã para usuários ativos
 * Escolhe versículo baseado no contexto e humor do usuário
 */
async function sendDailyVerse() {
    if (!sendMessageFunction) return;

    try {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Intervalo 6:30 - 8:00 AM
        if (currentHour !== 6 && currentHour !== 7) return;
        if (currentHour === 6 && currentMinute < 30) return;
        if (currentHour === 8 && currentMinute > 0) return;

        // Buscar usuários que solicitaram versículo da manhã
        const usuarios = db.prepare(`
            SELECT * FROM usuarios
            WHERE versiculo_diario_ativo = 1
            AND (horario_versiculo BETWEEN '06:30' AND '08:00' OR horario_versiculo IS NULL)
        `).all();

        for (const usuario of usuarios) {
            try {
                // Selecionar versículo baseado em contexto
                let versiculo;
                const historico = getHistorico(usuario.id, 5);

                if (historico.length > 0) {
                    // Detectar humor recente
                    const humorRecente = detectMood(historico[historico.length - 1].mensagem);

                    // Escolher versículo por tema baseado no humor
                    let temaPreferido = 'alegria';
                    if (humorRecente === 'triste' || humorRecente === 'desesperado') {
                        temaPreferido = 'esperança';
                    } else if (humorRecente === 'ansioso') {
                        temaPreferido = 'paz';
                    } else if (humorRecente === 'fraco') {
                        temaPreferido = 'força';
                    }

                    // Buscar versículo com tema
                    const versiculosComTema = VERSICULOS_MANHA.filter(v =>
                        v.temas.includes(temaPreferido) || v.temas.includes('alegria')
                    );
                    versiculo = versiculosComTema.length > 0
                        ? versiculosComTema[Math.floor(Math.random() * versiculosComTema.length)]
                        : VERSICULOS_MANHA[Math.floor(Math.random() * VERSICULOS_MANHA.length)];
                } else {
                    // Sem contexto, usar aleatório
                    versiculo = VERSICULOS_MANHA[Math.floor(Math.random() * VERSICULOS_MANHA.length)];
                }

                const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                const saudacoes = [
                    `Bom dia, ${nome}! 🌅`,
                    `Oi, ${nome}! Que belo dia é esse! 🙏`,
                    `${nome}, acordou com as bênçãos de hoje! ☀️`
                ];
                const saudacao = nome ? saudacoes[Math.floor(Math.random() * saudacoes.length)] : '🌅 Bom dia! 🙏';

                const mensagem = `${saudacao}\n\n📖 *Versículo da Manhã*\n\n"${versiculo.texto}"\n\n_${versiculo.referencia}_ 🙌`;

                const result = await sendWithRetry(usuario.telefone, mensagem);
                if (result.success) {
                    console.log(`[Scheduler] Versículo da manhã enviado para ${usuario.telefone}`);
                } else {
                    console.error(`[Scheduler] Falha ao enviar versículo da manhã para ${usuario.telefone}`);
                }

                await sleep(2000);
            } catch (error) {
                console.error(`[Scheduler] Erro ao processar versículo para usuário ${usuario.id}:`, error.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error sending daily verse:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 15. DESPEDIDA NOTURNA (APOS 21:00)
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica e envia despedida noturna para usuários
 * Usuários que:
 * - Última mensagem entre 21:00-23:00
 * - Sem resposta há 30+ minutos
 * - Não receberam despedida hoje
 */
async function checkNightFarewell() {
    if (!sendMessageFunction) return;

    try {
        const now = new Date();
        const currentHour = now.getHours();

        // Executar a cada 30 minutos após 21:00
        if (currentHour < 21) return;

        // Buscar usuários com última mensagem entre 21:00-23:00
        const usuarios = db.prepare(`
            SELECT u.*,
                   MAX(h.timestamp) as ultima_mensagem
            FROM usuarios u
            LEFT JOIN historico h ON u.id = h.usuario_id
            GROUP BY u.id
            HAVING strftime('%H', 'now', 'localtime') BETWEEN '21' AND '23'
        `).all();

        for (const usuario of usuarios) {
            try {
                // Verificar se já recebeu despedida hoje
                const jaDespedida = db.prepare(`
                    SELECT COUNT(*) as count FROM agendamentos
                    WHERE usuario_id = ?
                    AND tipo = 'despedida_noturna'
                    AND DATE(data_hora) = DATE('now')
                    AND enviado = 1
                `).get(usuario.id);

                if (jaDespedida && jaDespedida.count > 0) {
                    continue; // Já recebeu despedida hoje
                }

                // Calcular tempo desde última mensagem
                const ultimaMensagemDate = safeParseDate(usuario.ultima_mensagem);
                if (!ultimaMensagemDate) continue;

                const diffMinutos = Math.floor((now - ultimaMensagemDate) / (1000 * 60));

                // Se passou 30+ minutos, enviar despedida
                if (diffMinutos >= 30) {
                    const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                    const mensagens = [
                        `${nome ? 'Vai descansar, ' + nome + '?' : 'Vai descansar?'} 🌙 Eu velo teu sono. Amanhã conversamos. Boa noite! 💙`,
                        `${nome ? nome + ', ' : ''}que você tenha uma noite tranquila e repouso abençoado. Amanhã continuamos nossa conversa. 💤`,
                        `${nome ? 'Durma em paz, ' + nome + '.' : 'Durma em paz.'} Deus cuida de você enquanto descansa. Até amanhã! 🙏`
                    ];
                    const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];

                    const result = await sendWithRetry(usuario.telefone, mensagem);
                    if (result.success) {
                        // Registrar no banco
                        addAgendamento({
                            usuarioId: usuario.id,
                            tipo: 'despedida_noturna',
                            dataHora: now.toISOString(),
                            mensagem
                        });
                        console.log(`[Scheduler] Despedida noturna enviada para ${usuario.telefone}`);
                    } else {
                        console.error(`[Scheduler] Falha ao enviar despedida para ${usuario.telefone}`);
                    }

                    await sleep(2000);
                }

            } catch (error) {
                console.error(`[Scheduler] Erro ao processar despedida para ${usuario.id}:`, error.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error checking night farewell:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 6B. DATAS ESPECIAIS - EXTENSAO (9:00 AM)
// ═══════════════════════════════════════════════════════════════

/**
 * Função estendida para verificar datas especiais com mais contexto
 * Envia mensagens sobre marcos de relacionamento
 */
async function checkSpecialDatesExtended() {
    if (!sendMessageFunction) return;

    try {
        const today = new Date();
        const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Executar apenas às 9:00 AM
        if (today.getHours() !== 9 || today.getMinutes() > 5) return;

        console.log(`[Scheduler] Verificando datas especiais estendidas para: ${todayMMDD}`);

        const usuarios = db.prepare('SELECT * FROM usuarios WHERE datas_especiais IS NOT NULL OR aniversario IS NOT NULL').all();

        for (const usuario of usuarios) {
            // Marcos de aniversário de conversa já cobertos em checkSpecialDates
            // Aqui adicionamos contexto extra

            if (usuario.primeira_conversa) {
                const primeiraConversa = safeParseDate(usuario.primeira_conversa);
                if (!primeiraConversa) continue;

                const diffDays = Math.floor((today - primeiraConversa) / (1000 * 60 * 60 * 24));

                // Marcos adicionais: 7 dias, 14 dias
                const marcos = [7, 14];

                for (const marco of marcos) {
                    if (diffDays === marco) {
                        const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                        const contexto = marco === 7
                            ? `uma semana já que começamos nessa jornada juntos`
                            : `duas semanas desde que começamos a conversar`;

                        const mensagem = nome
                            ? `${nome}! 🎉 Hoje faz ${contexto}! Que bênção ter você comigo. Como tem sido sua experiência?`
                            : `🎉 Hoje faz ${contexto}! Que bênção estar junto a você nessa jornada. Tudo bem?`;

                        const result = await sendWithRetry(usuario.telefone, mensagem);
                        if (result.success) {
                            console.log(`[Scheduler] Marco de ${marco} dias enviado para ${usuario.telefone}`);
                        }

                        await sleep(2000);
                    }
                }
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error checking special dates extended:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 9. PADROES EMOCIONAIS (3:00 AM)
// ═══════════════════════════════════════════════════════════════

/**
 * Analisa padrões emocionais dos usuários por dia da semana
 * Atualiza tabela emotional_patterns para insights
 */
async function analyzeEmotionalPatterns() {
    try {
        const now = new Date();

        // Executar apenas às 3:00 AM
        if (now.getHours() !== 3 || now.getMinutes() > 5) return;

        // Criar tabela se não existir
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS emotional_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id INTEGER NOT NULL,
                    dia_semana TEXT,
                    humor_dominante TEXT,
                    frequencia_mensagens INTEGER,
                    horario_pico TEXT,
                    temas_frequentes TEXT,
                    data_analise TEXT,
                    UNIQUE(usuario_id, dia_semana),
                    FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
                )
            `);
        } catch (e) {
            // Tabela já existe
        }

        const usuarios = db.prepare('SELECT id FROM usuarios').all();
        const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
        const diaSemanaIndex = now.getDay();
        const diaSemana = diasSemana[diaSemanaIndex];

        for (const usuario of usuarios) {
            try {
                // Buscar histórico da última semana
                const umaSemanaAtras = new Date(now);
                umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

                const historico = db.prepare(`
                    SELECT * FROM historico
                    WHERE usuario_id = ?
                    AND datetime(timestamp) >= ?
                    AND datetime(timestamp) < ?
                    ORDER BY timestamp DESC
                `).all(usuario.id, umaSemanaAtras.toISOString(), now.toISOString());

                if (historico.length === 0) continue;

                // Analisar humores
                const humores = {};
                const horarios = [];
                const temas = [];

                for (const msg of historico) {
                    const humor = detectMood(msg.mensagem);
                    humores[humor] = (humores[humor] || 0) + 1;

                    const hora = new Date(msg.timestamp).getHours();
                    horarios.push(hora);

                    const topico = extractTopic(msg.mensagem);
                    if (topico) {
                        temas.push(topico);
                    }
                }

                // Encontrar humor dominante
                let humorDominante = 'neutro';
                let maxFreq = 0;
                for (const [humor, freq] of Object.entries(humores)) {
                    if (freq > maxFreq) {
                        maxFreq = freq;
                        humorDominante = humor;
                    }
                }

                // Horário pico
                const frequenciaHoras = {};
                for (const hora of horarios) {
                    frequenciaHoras[hora] = (frequenciaHoras[hora] || 0) + 1;
                }
                let horarioPico = '10:00';
                let maxHoraFreq = 0;
                for (const [hora, freq] of Object.entries(frequenciaHoras)) {
                    if (freq > maxHoraFreq) {
                        maxHoraFreq = freq;
                        horarioPico = `${String(hora).padStart(2, '0')}:00`;
                    }
                }

                // Temas frequentes
                const frecuenciaTemas = {};
                for (const tema of temas) {
                    frecuenciaTemas[tema] = (frecuenciaTemas[tema] || 0) + 1;
                }
                const temasTop = Object.entries(frecuenciaTemas)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([tema]) => tema);

                // Salvar análise
                db.prepare(`
                    INSERT OR REPLACE INTO emotional_patterns
                    (usuario_id, dia_semana, humor_dominante, frequencia_mensagens, horario_pico, temas_frequentes, data_analise)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                    usuario.id,
                    diaSemana,
                    humorDominante,
                    historico.length,
                    horarioPico,
                    JSON.stringify(temasTop),
                    now.toISOString()
                );

                console.log(`[Scheduler] Padrões emocionais analisados para usuário ${usuario.id} (${diaSemana}): ${humorDominante}`);

            } catch (error) {
                console.error(`[Scheduler] Erro ao analisar padrões para usuário ${usuario.id}:`, error.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error analyzing emotional patterns:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 13. MARCOS DE JORNADA (10:00 AM)
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica marcos de jornada: 7, 30, 100 dias, 1 ano
 * Envia reflexões de progresso personalizadas
 */
async function checkJourneyMilestones() {
    if (!sendMessageFunction) return;

    try {
        const now = new Date();

        // Executar apenas às 10:00 AM
        if (now.getHours() !== 10 || now.getMinutes() > 5) return;

        const usuarios = db.prepare(`
            SELECT * FROM usuarios
            WHERE primeira_conversa IS NOT NULL
        `).all();

        const marcos = [
            { dias: 7, mensagemBase: "uma semana", reflexao: "Como tem sido sua primeira semana conosco? Está descobrindo novas coisas sobre você?" },
            { dias: 30, mensagemBase: "um mês", reflexao: "Um mês é tempo suficiente para mudanças. Notou alguma transformação em você?" },
            { dias: 100, mensagemBase: "100 dias", reflexao: "100 dias é uma jornada significativa! Que lições aprendeu nesse tempo?" },
            { dias: 365, mensagemBase: "um ano", reflexao: "Um ano inteiro! Que bênção ter você nessa jornada. Como você mudou desde aquele primeiro dia?" }
        ];

        for (const usuario of usuarios) {
            try {
                const primeiraConversa = safeParseDate(usuario.primeira_conversa);
                if (!primeiraConversa) continue;

                const diffDays = Math.floor((now - primeiraConversa) / (1000 * 60 * 60 * 24));

                for (const marco of marcos) {
                    if (diffDays === marco.dias) {
                        const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';

                        const mensagem = `🎯 ${nome ? 'Oi, ' + nome + '! ' : ''}Hoje faz ${marco.mensagemBase} desde que começamos a conversar!\n\n${marco.reflexao}\n\nEstou aqui para ajudar você a crescer. 🙏`;

                        const result = await sendWithRetry(usuario.telefone, mensagem);
                        if (result.success) {
                            console.log(`[Scheduler] Marco de ${marco.dias} dias enviado para ${usuario.telefone}`);
                        }

                        await sleep(2000);
                    }
                }

            } catch (error) {
                console.error(`[Scheduler] Erro ao processar marcos para usuário ${usuario.id}:`, error.message);
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error checking journey milestones:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACAO E CONTROLE
// ═══════════════════════════════════════════════════════════════

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

    // Check for pending follow-ups based on configured interval (defaults to 1 min)
    const minutesInterval = Math.max(1, Math.round(CHECK_INTERVAL_MS / 60000));
    const cronExpression = `*/${minutesInterval} * * * *`;

    const checkJob = cron.schedule(cronExpression, async () => {
        console.log('[Scheduler] Checking pending follow-ups...');
        await checkPendingFollowUps();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('check_followups', checkJob);

    // Job para verificar versículos diários (a cada minuto para pegar horários exatos)
    const verseJob = cron.schedule('* * * * *', async () => {
        await sendDailyVerses();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('daily_verses', verseJob);

    // Job para verificar datas especiais (uma vez por dia às 8h)
    const specialDatesJob = cron.schedule('0 8 * * *', async () => {
        await checkSpecialDates();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('special_dates', specialDatesJob);

    // Job para versículo da manhã (6:30-8:00 AM)
    const morningVerseJob = cron.schedule('*/5 6-7 * * *', async () => {
        await sendDailyVerse();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('morning_verse', morningVerseJob);

    // Job para datas especiais estendidas (9:00 AM)
    const specialDatesExtendedJob = cron.schedule('0 9 * * *', async () => {
        await checkSpecialDatesExtended();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('special_dates_extended', specialDatesExtendedJob);

    // Job para marcos de jornada (10:00 AM)
    const journeyMilestonesJob = cron.schedule('0 10 * * *', async () => {
        await checkJourneyMilestones();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('journey_milestones', journeyMilestonesJob);

    // Job para análise de padrões emocionais (3:00 AM)
    const emotionalPatternsJob = cron.schedule('0 3 * * *', async () => {
        await analyzeEmotionalPatterns();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('emotional_patterns', emotionalPatternsJob);

    // Job para despedida noturna (a cada 30 min após 21:00)
    const nightFarewellJob = cron.schedule('*/30 21-23 * * *', async () => {
        await checkNightFarewell();
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    cronJobs.set('night_farewell', nightFarewellJob);

    isInitialized = true;

    console.log('[Scheduler] Initialized successfully');
    console.log(`[Scheduler] Checking for pending follow-ups every ${minutesInterval} minute(s)`);
    console.log('[Scheduler] Daily verses check enabled');
    console.log('[Scheduler] Special dates check enabled');
    console.log('[Scheduler] Morning verses (6:30-8:00 AM) enabled');
    console.log('[Scheduler] Special dates extended (9:00 AM) enabled');
    console.log('[Scheduler] Journey milestones (10:00 AM) enabled');
    console.log('[Scheduler] Emotional patterns analysis (3:00 AM) enabled');
    console.log('[Scheduler] Night farewell (every 30 min after 21:00) enabled');

    // Run initial check
    setTimeout(() => checkPendingFollowUps(), 3000);

    return {
        status: 'initialized',
        checkIntervalMinutes: minutesInterval,
        timezone: TIMEZONE
    };
}

// ═══════════════════════════════════════════════════════════════
// 1. FOLLOW-UPS CONTEXTUAIS
// ═══════════════════════════════════════════════════════════════

/**
 * Gera uma mensagem de follow-up contextual baseada no histórico
 * @param {number} userId - ID do usuário
 * @param {object} context - Contexto adicional (opcional)
 * @returns {Promise<string>} Mensagem personalizada
 */
export async function generateContextualFollowUp(userId, context = {}) {
    try {
        // Buscar histórico recente
        const historico = getHistorico(userId, 10);
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);

        if (!usuario) {
            return generateGenericFollowUp();
        }

        const nome = usuario.nome ? usuario.nome.split(' ')[0] : null;
        const saudacao = nome ? `Olá, ${nome}! ` : 'Olá! ';

        // Analisar último assunto
        let ultimoAssunto = usuario.ultimo_assunto;

        if (!ultimoAssunto && historico.length > 0) {
            // Tentar extrair o último assunto das conversas
            const ultimaMensagem = historico[historico.length - 1];
            ultimoAssunto = extractTopic(ultimaMensagem.mensagem);
        }

        // Detectar humor recente
        const humorRecente = historico.length > 0
            ? detectMood(historico[historico.length - 1].mensagem)
            : 'neutro';

        // Construir mensagem contextual
        const mensagens = [];

        // Se temos um assunto específico
        if (ultimoAssunto) {
            mensagens.push(
                `${saudacao}Fiquei pensando em você e naquela conversa sobre ${ultimoAssunto}. Como está tudo por aí?`,
                `${saudacao}Lembrei de você! Como foi aquela situação que conversamos sobre ${ultimoAssunto}?`,
                `${saudacao}Passei para saber... como está a situação com ${ultimoAssunto} que você mencionou?`
            );
        }

        // Mensagens baseadas no humor
        if (humorRecente === 'triste' || humorRecente === 'ansioso') {
            mensagens.push(
                `${saudacao}Tenho pensado muito em você desde nossa última conversa. Como está seu coração hoje?`,
                `${saudacao}Você esteve em minhas orações. Gostaria de saber como você está se sentindo.`,
                `${saudacao}Oi, passei para ver como você está... Espero que esteja melhor. 💙`
            );
        }

        // Se usuário mencionou família
        const familia = safeParseSchedulerJson(usuario.familia, {});
        if (familia.filhos || familia.esposa || familia.esposo || familia.mae || familia.pai) {
            mensagens.push(
                `${saudacao}Como está a família? Vocês têm estado em minhas orações.`,
                `${saudacao}Espero que esteja tudo bem com você e sua família. Como vão as coisas?`
            );
        }

        // Se usuário mencionou trabalho
        const trabalho = safeParseSchedulerJson(usuario.trabalho, {});
        if (trabalho.desafios || trabalho.profissao) {
            mensagens.push(
                `${saudacao}Como estão as coisas no trabalho? Você mencionou alguns desafios...`,
                `${saudacao}Pensei em você! Como está sendo a semana no trabalho?`
            );
        }

        // Se usuário tem jornada espiritual
        const jornada = safeParseSchedulerJson(usuario.jornada_espiritual, {});
        if (jornada.oracoes || jornada.leitura_biblica) {
            mensagens.push(
                `${saudacao}Como tem sido sua caminhada espiritual? Tem conseguido manter seus momentos de oração?`,
                `${saudacao}Você tem lido a Palavra? Gostaria de ouvir como está sua jornada.`
            );
        }

        // Adicionar mensagens genéricas como fallback
        mensagens.push(
            `${saudacao}Estava pensando em você e quis saber como está. 💙`,
            `${saudacao}Oi! Como tem passado? Estou aqui se precisar conversar.`,
            `${saudacao}Deus me colocou você em meu coração hoje. Como posso te abençoar?`
        );

        // Selecionar mensagem aleatória
        const mensagemSelecionada = mensagens[Math.floor(Math.random() * mensagens.length)];

        return mensagemSelecionada;

    } catch (error) {
        console.error('[Scheduler] Error generating contextual follow-up:', error.message);
        return generateGenericFollowUp();
    }
}

/**
 * Extrai o tópico principal de uma mensagem
 * @param {string} mensagem - Mensagem do usuário
 * @returns {string|null} Tópico extraído ou null
 */
function extractTopic(mensagem) {
    if (!mensagem) return null;

    const msgLower = mensagem.toLowerCase();

    // Padrões de tópicos comuns
    const topicos = {
        'seu chefe': /(?:meu chefe|o chefe|chefe|patrão)/i,
        'seu trabalho': /(?:meu trabalho|emprego|carreira|profissão)/i,
        'sua saúde': /(?:doença|doente|médico|hospital|exame|saúde)/i,
        'seu casamento': /(?:casamento|esposa|esposo|marido|mulher|relacionamento)/i,
        'seus filhos': /(?:meu filho|minha filha|filhos|filhas|crianças)/i,
        'sua família': /(?:família|parentes|mãe|pai|irmão|irmã)/i,
        'sua ansiedade': /(?:ansiedade|ansioso|nervoso|preocupado)/i,
        'sua depressão': /(?:depressão|deprimido|triste|tristeza)/i,
        'suas finanças': /(?:dinheiro|financeiro|dívida|conta|banco)/i,
        'sua fé': /(?:fé|igreja|deus|oração|bíblia|espiritual)/i,
        'aquela decisão': /(?:decisão|escolha|decidir|opção)/i,
        'aquele problema': /(?:problema|dificuldade|obstáculo)/i
    };

    for (const [topico, pattern] of Object.entries(topicos)) {
        if (pattern.test(msgLower)) {
            return topico;
        }
    }

    return null;
}

/**
 * Gera uma mensagem genérica de follow-up
 * @returns {string}
 */
function generateGenericFollowUp() {
    const mensagens = [
        'Olá! Deus te colocou em meu coração hoje. Como você está?',
        'Oi! Passei para saber como você está. Estou aqui se precisar conversar.',
        'Olá! Estive pensando em você. Como tem passado?',
        'Oi! Espero que esteja tendo uma semana abençoada. Tudo bem por aí?'
    ];

    return mensagens[Math.floor(Math.random() * mensagens.length)];
}

/**
 * Salva o último assunto discutido para follow-ups contextuais
 * @param {string} telefone - Telefone do usuário
 * @param {string} mensagem - Última mensagem do usuário
 */
export function saveLastTopic(telefone, mensagem) {
    try {
        const topico = extractTopic(mensagem);
        if (topico) {
            const stmt = db.prepare('UPDATE usuarios SET ultimo_assunto = ? WHERE telefone = ?');
            stmt.run(topico, telefone);
        }
    } catch (error) {
        console.error('[Scheduler] Error saving last topic:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. DETECCAO DE PADROES DE HORARIO
// ═══════════════════════════════════════════════════════════════

/**
 * Analisa os padrões de horário do usuário
 * @param {number} userId - ID do usuário
 * @returns {object} Análise de padrões de horário
 */
export function analyzeUserTimePatterns(userId) {
    try {
        // Buscar histórico de mensagens
        const historico = getHistorico(userId, 100);

        if (historico.length < 5) {
            return {
                hasEnoughData: false,
                preferredHour: 10, // Default: 10h da manhã
                preferredPeriod: 'manha',
                confidence: 0
            };
        }

        // Extrair horas das mensagens
        const horas = historico.map(msg => {
            const date = new Date(msg.timestamp);
            return date.getHours();
        });

        // Calcular hora mais frequente
        const frequencia = {};
        for (const hora of horas) {
            frequencia[hora] = (frequencia[hora] || 0) + 1;
        }

        let horaPreferida = 10;
        let maxFreq = 0;

        for (const [hora, freq] of Object.entries(frequencia)) {
            if (freq > maxFreq) {
                maxFreq = freq;
                horaPreferida = parseInt(hora);
            }
        }

        // Calcular média também
        const mediaHoras = horas.reduce((a, b) => a + b, 0) / horas.length;

        // Determinar período do dia
        let periodo;
        if (horaPreferida >= 5 && horaPreferida < 12) periodo = 'manha';
        else if (horaPreferida >= 12 && horaPreferida < 18) periodo = 'tarde';
        else if (horaPreferida >= 18 && horaPreferida < 22) periodo = 'noite';
        else periodo = 'madrugada';

        // Salvar padrão no banco
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
        if (usuario) {
            const horariosAntigos = safeParseSchedulerJson(usuario.horarios_mensagens, []);

            // Adicionar novas horas (mantendo últimas 100)
            const novosHorarios = [...horariosAntigos, ...horas].slice(-100);

            db.prepare('UPDATE usuarios SET horarios_mensagens = ? WHERE id = ?')
                .run(JSON.stringify(novosHorarios), userId);
        }

        return {
            hasEnoughData: true,
            preferredHour: horaPreferida,
            averageHour: Math.round(mediaHoras),
            preferredPeriod: periodo,
            confidence: Math.min(maxFreq / horas.length, 1),
            sampleSize: horas.length
        };

    } catch (error) {
        console.error('[Scheduler] Error analyzing time patterns:', error.message);
        return {
            hasEnoughData: false,
            preferredHour: 10,
            preferredPeriod: 'manha',
            confidence: 0,
            error: error.message
        };
    }
}

/**
 * Calcula o melhor horário para enviar mensagem ao usuário
 * @param {number} userId - ID do usuário
 * @returns {Date} Próximo horário ideal para contato
 */
export function getBestTimeForUser(userId) {
    const patterns = analyzeUserTimePatterns(userId);
    const now = new Date();

    // Se não temos dados suficientes, usar horário padrão
    const targetHour = patterns.hasEnoughData
        ? patterns.preferredHour
        : 10;

    // Criar data para hoje no horário preferido
    const targetTime = new Date(now);
    targetTime.setHours(targetHour, 0, 0, 0);

    // Se já passou, agendar para amanhã
    if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }

    // Respeitar quiet hours
    const quiet = config?.SCHEDULER_CONFIG?.quietHours;
    if (quiet) {
        const hour = targetTime.getHours();
        if (hour >= quiet.start || hour < quiet.end) {
            targetTime.setHours(quiet.end, 0, 0, 0);
            if (targetTime <= now) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
        }
    }

    return targetTime;
}

/**
 * Registra horário de mensagem para análise futura
 * @param {string} telefone - Telefone do usuário
 */
export function recordMessageTime(telefone) {
    try {
        const usuario = getUsuario(telefone);
        if (!usuario) return;

        const hora = new Date().getHours();

        let horarios = safeParseSchedulerJson(usuario.horarios_mensagens, []);

        horarios.push(hora);

        // Manter últimos 100 registros
        if (horarios.length > 100) {
            horarios = horarios.slice(-100);
        }

        db.prepare('UPDATE usuarios SET horarios_mensagens = ? WHERE telefone = ?')
            .run(JSON.stringify(horarios), telefone);

    } catch (error) {
        console.error('[Scheduler] Error recording message time:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. DATAS ESPECIAIS
// ═══════════════════════════════════════════════════════════════

/**
 * Agenda um lembrete para data especial
 * @param {number} userId - ID do usuário
 * @param {string} date - Data no formato 'MM-DD' ou 'YYYY-MM-DD'
 * @param {string} type - Tipo: 'aniversario', 'aniversario_conversa', 'data_especial'
 * @param {string} description - Descrição opcional
 * @returns {object} Resultado do agendamento
 */
export async function scheduleSpecialDateReminder(userId, date, type, description = null) {
    try {
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
        if (!usuario) {
            throw new Error(`Usuário não encontrado: ${userId}`);
        }

        // Normalizar data para MM-DD se vier completa
        let normalizedDate = date;
        if (date.length === 10) {
            normalizedDate = date.substring(5); // Pega MM-DD
        }

        // Carregar datas especiais existentes
        let datasEspeciais = safeParseSchedulerJson(usuario.datas_especiais, []);

        // Verificar se já existe
        const existe = datasEspeciais.find(d => d.date === normalizedDate && d.type === type);
        if (existe) {
            return { success: true, message: 'Data já registrada', existing: true };
        }

        // Adicionar nova data
        datasEspeciais.push({
            date: normalizedDate,
            type,
            description,
            createdAt: new Date().toISOString()
        });

        // Salvar no banco
        db.prepare('UPDATE usuarios SET datas_especiais = ? WHERE id = ?')
            .run(JSON.stringify(datasEspeciais), userId);

        // Se for aniversário, também salvar no campo específico
        if (type === 'aniversario') {
            db.prepare('UPDATE usuarios SET aniversario = ? WHERE id = ?')
                .run(normalizedDate, userId);
        }

        console.log(`[Scheduler] Data especial registrada: ${type} em ${normalizedDate} para usuário ${userId}`);

        return {
            success: true,
            date: normalizedDate,
            type,
            description
        };

    } catch (error) {
        console.error('[Scheduler] Error scheduling special date:', error.message);
        throw error;
    }
}

/**
 * Detecta e salva aniversário mencionado na conversa
 * @param {string} telefone - Telefone do usuário
 * @param {string} mensagem - Mensagem do usuário
 */
export function detectAndSaveBirthday(telefone, mensagem) {
    const patterns = [
        /(?:meu aniversário é|faço aniversário|nasci).*?(\d{1,2})[\/\-](\d{1,2})/i,
        /(?:aniversário|birthday).*?dia\s+(\d{1,2}).*?(?:de\s+)?(\w+)/i,
        /(\d{1,2})[\/\-](\d{1,2}).*?(?:meu aniversário|nasci|faço anos)/i
    ];

    const meses = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
        'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
        'agosto': '08', 'setembro': '09', 'outubro': '10',
        'novembro': '11', 'dezembro': '12'
    };

    for (const pattern of patterns) {
        const match = mensagem.match(pattern);
        if (match) {
            let dia = match[1];
            let mes = match[2];

            // Converter nome do mês para número
            if (meses[mes.toLowerCase()]) {
                mes = meses[mes.toLowerCase()];
            }

            // Validar
            const diaNum = parseInt(dia);
            const mesNum = parseInt(mes);

            if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12) {
                const dateStr = `${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

                const usuario = getUsuario(telefone);
                if (usuario) {
                    scheduleSpecialDateReminder(usuario.id, dateStr, 'aniversario')
                        .then(() => console.log(`[Scheduler] Aniversário detectado e salvo: ${dateStr}`))
                        .catch(err => console.error('[Scheduler] Erro ao salvar aniversário:', err));
                }
                break;
            }
        }
    }
}

/**
 * Registra primeira conversa para aniversário de conversa
 * @param {string} telefone - Telefone do usuário
 */
export function recordFirstConversation(telefone) {
    try {
        const usuario = getUsuario(telefone);
        if (usuario && !usuario.primeira_conversa) {
            const today = new Date().toISOString().split('T')[0];
            db.prepare('UPDATE usuarios SET primeira_conversa = ? WHERE telefone = ?')
                .run(today, telefone);
            console.log(`[Scheduler] Primeira conversa registrada: ${today}`);
        }
    } catch (error) {
        console.error('[Scheduler] Error recording first conversation:', error.message);
    }
}

/**
 * Verifica datas especiais e envia mensagens
 */
async function checkSpecialDates() {
    if (!sendMessageFunction) return;

    try {
        const today = new Date();
        const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        console.log(`[Scheduler] Verificando datas especiais para: ${todayMMDD}`);

        // Buscar todos os usuários com datas especiais
        const usuarios = db.prepare('SELECT * FROM usuarios WHERE datas_especiais IS NOT NULL OR aniversario IS NOT NULL').all();

        for (const usuario of usuarios) {
            // Verificar aniversário
            if (usuario.aniversario === todayMMDD) {
                const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                const mensagem = nome
                    ? `🎂 Feliz Aniversário, ${nome}! Que Deus abençoe ricamente este novo ano de vida. Que você seja cheio(a) de alegria, saúde e paz. Você é muito especial! 🙏✨`
                    : `🎂 Feliz Aniversário! Que Deus abençoe ricamente este novo ano de vida. Que você seja cheio(a) de alegria, saúde e paz. 🙏✨`;

                const result = await sendWithRetry(usuario.telefone, mensagem);
                if (result.success) {
                    console.log(`[Scheduler] Mensagem de aniversário enviada para ${usuario.telefone} (${result.attempts} tentativa(s))`);
                } else {
                    console.error(`[Scheduler] Falha ao enviar aniversário para ${usuario.telefone} após ${result.attempts} tentativas`);
                }
                await sleep(2000);
            }

            // Verificar aniversário de conversa
            if (usuario.primeira_conversa) {
                const primeiraConversa = safeParseDate(usuario.primeira_conversa);
                if (!primeiraConversa) continue;
                const diffDays = Math.floor((today - primeiraConversa) / (1000 * 60 * 60 * 24));

                // 1 mês (30 dias)
                if (diffDays === 30) {
                    const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                    const mensagem = nome
                        ? `${nome}, já faz 1 mês desde nossa primeira conversa! 🙏 Estou muito feliz em caminhar ao seu lado. Como tem sido sua jornada nesse tempo?`
                        : `Já faz 1 mês desde nossa primeira conversa! 🙏 Estou muito feliz em caminhar ao seu lado. Como tem sido sua jornada nesse tempo?`;

                    const result = await sendWithRetry(usuario.telefone, mensagem);
                    if (result.success) {
                        console.log(`[Scheduler] Aniversário de 1 mês enviado para ${usuario.telefone} (${result.attempts} tentativa(s))`);
                    } else {
                        console.error(`[Scheduler] Falha ao enviar aniversário de 1 mês para ${usuario.telefone}`);
                    }
                    await sleep(2000);
                }

                // 1 ano (365 dias)
                if (diffDays === 365) {
                    const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                    const mensagem = nome
                        ? `${nome}! 🎉 Hoje faz exatamente 1 ano desde que começamos a conversar! Que bênção ter você comigo nessa caminhada. Muito obrigado por sua confiança. Que Deus continue te abençoando! 🙏💙`
                        : `🎉 Hoje faz exatamente 1 ano desde nossa primeira conversa! Que bênção caminhar ao seu lado. Muito obrigado por sua confiança. Que Deus continue te abençoando! 🙏💙`;

                    const result = await sendWithRetry(usuario.telefone, mensagem);
                    if (result.success) {
                        console.log(`[Scheduler] Aniversário de 1 ano enviado para ${usuario.telefone} (${result.attempts} tentativa(s))`);
                    } else {
                        console.error(`[Scheduler] Falha ao enviar aniversário de 1 ano para ${usuario.telefone}`);
                    }
                    await sleep(2000);
                }
            }

            // Verificar outras datas especiais
            const datasEspeciais = safeParseSchedulerJson(usuario.datas_especiais, []);

            for (const data of datasEspeciais) {
                if (data.date === todayMMDD && data.type === 'data_especial') {
                    const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';
                    const mensagem = data.description
                        ? `${nome ? nome + ', ' : ''}lembrei de você hoje por causa de ${data.description}. Espero que seja um dia especial! 🙏`
                        : `${nome ? nome + ', ' : ''}hoje é um dia especial para você! Estou aqui se quiser conversar. 🙏`;

                    const result = await sendWithRetry(usuario.telefone, mensagem);
                    if (result.success) {
                        console.log(`[Scheduler] Data especial enviada para ${usuario.telefone} (${result.attempts} tentativa(s))`);
                    } else {
                        console.error(`[Scheduler] Falha ao enviar data especial para ${usuario.telefone}`);
                    }
                    await sleep(2000);
                }
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error checking special dates:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. CHECK-IN POS-CRISE
// ═══════════════════════════════════════════════════════════════

/**
 * Agenda um check-in sensível após detectar crise
 * @param {number} userId - ID do usuário
 * @param {string} crisisType - Tipo de crise detectada
 * @param {number} hoursDelay - Horas de delay (default: 24)
 * @returns {object} Resultado do agendamento
 */
export async function scheduleCrisisCheckIn(userId, crisisType, hoursDelay = 24) {
    try {
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
        if (!usuario) {
            throw new Error(`Usuário não encontrado: ${userId}`);
        }

        const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';

        // Mensagens sensíveis por tipo de crise
        const mensagens = {
            desesperado: [
                `${nome ? nome + ', ' : ''}oi... 💙 Passei para ver como você está. Estive pensando em você e orando. Espero que esteja melhor.`,
                `${nome ? 'Oi ' + nome + ', ' : 'Oi, '}não esqueci de você. Como está se sentindo hoje? Estou aqui, sem pressa, se quiser conversar. 🙏`
            ],
            triste: [
                `${nome ? nome + ', ' : ''}passei para te ver. Como está seu coração hoje? Lembre-se: tempestades passam. 💙`,
                `${nome ? 'Oi ' + nome + ', ' : 'Oi, '}estava pensando em você. Espero que hoje esteja sendo mais leve. Estou aqui. 🙏`
            ],
            ansioso: [
                `${nome ? nome + ', ' : ''}como está? Conseguiu descansar um pouco? Lembre-se de respirar fundo. Deus está no controle. 🙏`,
                `${nome ? 'Oi ' + nome + '! ' : 'Oi! '}Passei para saber como você está. A paz de Deus seja contigo. 💙`
            ],
            com_medo: [
                `${nome ? nome + ', ' : ''}oi... 💙 Como você está? "Não temas, porque Eu sou contigo." Estou aqui se precisar.`,
                `${nome ? 'Oi ' + nome + ', ' : 'Oi, '}passei para ver você. Como está se sentindo? Lembre-se: você não está sozinho. 🙏`
            ],
            dor: [
                `${nome ? nome + ', ' : ''}como está? 💙 Estive orando por você. Espero que esteja se sentindo melhor.`,
                `${nome ? 'Oi ' + nome + ', ' : 'Oi, '}passei para te abraçar (mesmo que virtualmente). Como você está? 🙏`
            ]
        };

        // Selecionar mensagem adequada
        const tipoMensagens = mensagens[crisisType] || mensagens.desesperado;
        const mensagem = tipoMensagens[Math.floor(Math.random() * tipoMensagens.length)];

        // Calcular horário do check-in
        const checkInTime = new Date();
        checkInTime.setHours(checkInTime.getHours() + hoursDelay);

        // Verificar padrões de horário do usuário
        const patterns = analyzeUserTimePatterns(userId);
        if (patterns.hasEnoughData) {
            // Ajustar para o horário preferido se o delay permitir
            const preferredCheckIn = new Date(checkInTime);
            preferredCheckIn.setHours(patterns.preferredHour, 0, 0, 0);

            // Se o horário preferido é após o mínimo, usar ele
            if (preferredCheckIn > checkInTime) {
                checkInTime.setTime(preferredCheckIn.getTime());
            }
        }

        // Agendar no banco
        const agendamento = addAgendamento({
            usuarioId: userId,
            tipo: 'crisis_checkin',
            dataHora: checkInTime.toISOString(),
            mensagem
        });

        // Adicionar contexto
        db.prepare('UPDATE agendamentos SET contexto = ?, subtipo = ? WHERE id = ?')
            .run(crisisType, 'checkin_pos_crise', agendamento.id);

        console.log(`[Scheduler] Crisis check-in agendado para ${usuario.telefone} em ${checkInTime.toISOString()}`);

        return {
            success: true,
            agendamentoId: agendamento.id,
            scheduledFor: checkInTime.toISOString(),
            crisisType
        };

    } catch (error) {
        console.error('[Scheduler] Error scheduling crisis check-in:', error.message);
        throw error;
    }
}

/**
 * Detecta crise e agenda check-in automaticamente
 * @param {string} telefone - Telefone do usuário
 * @param {string} mensagem - Mensagem do usuário
 */
export function detectCrisisAndScheduleCheckIn(telefone, mensagem) {
    const humor = detectMood(mensagem);

    // Tipos de crise que requerem check-in
    const crisisTypes = ['desesperado', 'com_medo'];
    const moderateTypes = ['triste', 'ansioso', 'dor'];

    if (crisisTypes.includes(humor)) {
        const usuario = getUsuario(telefone);
        if (usuario) {
            // Check-in em 24h para crises severas
            scheduleCrisisCheckIn(usuario.id, humor, 24)
                .catch(err => console.error('[Scheduler] Erro ao agendar crisis check-in:', err));
        }
    } else if (moderateTypes.includes(humor)) {
        const usuario = getUsuario(telefone);
        if (usuario) {
            // Check-in em 48h para situações moderadas
            scheduleCrisisCheckIn(usuario.id, humor, 48)
                .catch(err => console.error('[Scheduler] Erro ao agendar check-in moderado:', err));
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 5. VERSICULO DO DIA
// ═══════════════════════════════════════════════════════════════

/**
 * Inscreve usuário no versículo diário
 * @param {number} userId - ID do usuário
 * @param {string} time - Horário desejado (formato HH:MM)
 * @returns {object} Resultado da inscrição
 */
export async function enrollDailyVerse(userId, time = '07:00') {
    try {
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
        if (!usuario) {
            throw new Error(`Usuário não encontrado: ${userId}`);
        }

        // Validar formato do horário
        if (!/^\d{2}:\d{2}$/.test(time)) {
            throw new Error('Formato de horário inválido. Use HH:MM');
        }

        // Atualizar no banco
        db.prepare(`
            UPDATE usuarios
            SET versiculo_diario_ativo = 1, horario_versiculo = ?
            WHERE id = ?
        `).run(time, userId);

        console.log(`[Scheduler] Usuário ${userId} inscrito no versículo diário às ${time}`);

        return {
            success: true,
            userId,
            time,
            message: `Você receberá um versículo todos os dias às ${time}! 🙏`
        };

    } catch (error) {
        console.error('[Scheduler] Error enrolling daily verse:', error.message);
        throw error;
    }
}

/**
 * Cancela inscrição do versículo diário
 * @param {number} userId - ID do usuário
 * @returns {object} Resultado do cancelamento
 */
export async function unenrollDailyVerse(userId) {
    try {
        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
        if (!usuario) {
            throw new Error(`Usuário não encontrado: ${userId}`);
        }

        db.prepare('UPDATE usuarios SET versiculo_diario_ativo = 0 WHERE id = ?')
            .run(userId);

        console.log(`[Scheduler] Usuário ${userId} removido do versículo diário`);

        return {
            success: true,
            userId,
            message: 'Você foi removido do versículo diário. Pode se inscrever novamente a qualquer momento!'
        };

    } catch (error) {
        console.error('[Scheduler] Error unenrolling daily verse:', error.message);
        throw error;
    }
}

/**
 * Altera o horário do versículo diário
 * @param {number} userId - ID do usuário
 * @param {string} newTime - Novo horário (formato HH:MM)
 * @returns {object} Resultado da alteração
 */
export async function changeDailyVerseTime(userId, newTime) {
    try {
        if (!/^\d{2}:\d{2}$/.test(newTime)) {
            throw new Error('Formato de horário inválido. Use HH:MM');
        }

        db.prepare('UPDATE usuarios SET horario_versiculo = ? WHERE id = ?')
            .run(newTime, userId);

        console.log(`[Scheduler] Horário do versículo alterado para ${newTime} (usuário ${userId})`);

        return {
            success: true,
            newTime,
            message: `Horário alterado! Agora você receberá seu versículo às ${newTime}. 🙏`
        };

    } catch (error) {
        console.error('[Scheduler] Error changing verse time:', error.message);
        throw error;
    }
}

/**
 * Obtém um versículo aleatório
 * @returns {object} Versículo com texto e referência
 */
export function getRandomVerse() {
    const index = Math.floor(Math.random() * VERSICULOS.length);
    return VERSICULOS[index];
}

/**
 * Envia versículos diários para usuários inscritos
 */
async function sendDailyVerses() {
    if (!sendMessageFunction) return;

    try {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Buscar usuários que devem receber versículo agora
        const usuarios = db.prepare(`
            SELECT * FROM usuarios
            WHERE versiculo_diario_ativo = 1
            AND horario_versiculo = ?
        `).all(currentTime);

        for (const usuario of usuarios) {
            const versiculo = getRandomVerse();
            const nome = usuario.nome ? usuario.nome.split(' ')[0] : '';

            const mensagem = `📖 *Versículo do Dia*${nome ? ` para ${nome}` : ''}\n\n"${versiculo.texto}"\n\n_${versiculo.referencia}_ 🙏`;

            const result = await sendWithRetry(usuario.telefone, mensagem);
            if (result.success) {
                console.log(`[Scheduler] Versículo enviado para ${usuario.telefone} (${result.attempts} tentativa(s))`);
            } else {
                console.error(`[Scheduler] Falha ao enviar versículo para ${usuario.telefone} após ${result.attempts} tentativas`);
            }

            await sleep(2000);
        }

    } catch (error) {
        console.error('[Scheduler] Error sending daily verses:', error.message);
    }
}

/**
 * Detecta se usuário quer receber versículo diário e processa
 * @param {string} telefone - Telefone do usuário
 * @param {string} mensagem - Mensagem do usuário
 * @returns {object|null} Resposta se detectou comando, null se não
 */
export function processVerseCommand(telefone, mensagem) {
    const msgLower = mensagem.toLowerCase().trim();

    const usuario = getUsuario(telefone);
    if (!usuario) return null;

    // Comandos para inscrever
    const inscricaoPatterns = [
        /(?:quero|gostaria|me inscreva|ativar|receber)\s*(?:no|o)?\s*vers[ií]culo\s*(?:do dia|di[aá]rio)?/i,
        /(?:me manda|mande|envie)\s*vers[ií]culo\s*(?:todo dia|todos os dias|di[aá]rio)/i,
        /(?:ativar|ligar)\s*vers[ií]culo/i
    ];

    for (const pattern of inscricaoPatterns) {
        if (pattern.test(msgLower)) {
            // Tentar extrair horário
            const horarioMatch = mensagem.match(/(\d{1,2})[:\s]?(\d{2})?/);
            let horario = '07:00';

            if (horarioMatch) {
                const hora = horarioMatch[1].padStart(2, '0');
                const minuto = (horarioMatch[2] || '00').padStart(2, '0');
                horario = `${hora}:${minuto}`;
            }

            enrollDailyVerse(usuario.id, horario)
                .catch(err => console.error('[Scheduler] Erro ao inscrever versículo:', err));

            return {
                action: 'enrolled',
                time: horario,
                message: `Pronto! 🙏 Você receberá um versículo todos os dias às ${horario}. Que a Palavra de Deus ilumine seus caminhos!`
            };
        }
    }

    // Comandos para cancelar
    const cancelamentoPatterns = [
        /(?:cancelar|parar|desativar|remover)\s*vers[ií]culo/i,
        /(?:n[aã]o quero|n[aã]o preciso)\s*(?:mais)?\s*vers[ií]culo/i,
        /(?:desligar|tirar)\s*vers[ií]culo/i
    ];

    for (const pattern of cancelamentoPatterns) {
        if (pattern.test(msgLower)) {
            unenrollDailyVerse(usuario.id)
                .catch(err => console.error('[Scheduler] Erro ao desinscrever versículo:', err));

            return {
                action: 'unenrolled',
                message: 'Tudo bem, você não receberá mais o versículo diário. Pode ativar novamente quando quiser! 🙏'
            };
        }
    }

    // Comandos para alterar horário
    const alterarHorarioPatterns = [
        /(?:mudar|alterar|trocar)\s*(?:o)?\s*hor[aá]rio\s*(?:do)?\s*vers[ií]culo/i,
        /vers[ií]culo\s*(?:[àa]s|as)?\s*(\d{1,2})[:\s]?(\d{2})?/i
    ];

    for (const pattern of alterarHorarioPatterns) {
        const match = mensagem.match(pattern);
        if (match) {
            // Extrair novo horário
            const horarioMatch = mensagem.match(/(\d{1,2})[:\s]?(\d{2})?/);
            if (horarioMatch) {
                const hora = horarioMatch[1].padStart(2, '0');
                const minuto = (horarioMatch[2] || '00').padStart(2, '0');
                const novoHorario = `${hora}:${minuto}`;

                changeDailyVerseTime(usuario.id, novoHorario)
                    .catch(err => console.error('[Scheduler] Erro ao alterar horário:', err));

                return {
                    action: 'time_changed',
                    time: novoHorario,
                    message: `Horário atualizado! 🕐 Agora você receberá seu versículo às ${novoHorario}. Deus te abençoe! 🙏`
                };
            }
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════
// 6. SMART RETRY
// ═══════════════════════════════════════════════════════════════

/**
 * Marca que uma mensagem foi respondida pelo usuário
 * @param {string} telefone - Telefone do usuário
 */
export function markUserResponded(telefone) {
    try {
        // Marcar agendamentos recentes como respondidos
        const usuario = getUsuario(telefone);
        if (!usuario) return;

        db.prepare(`
            UPDATE agendamentos
            SET respondido = 1
            WHERE usuario_id = ?
            AND enviado = 1
            AND respondido = 0
            AND datetime(data_hora) >= datetime('now', '-48 hours')
        `).run(usuario.id);

    } catch (error) {
        console.error('[Scheduler] Error marking user responded:', error.message);
    }
}

/**
 * Reagenda mensagem não respondida com smart retry
 * @param {number} agendamentoId - ID do agendamento
 * @returns {object|null} Novo agendamento ou null se limite atingido
 */
export async function smartRetry(agendamentoId) {
    try {
        const agendamento = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(agendamentoId);
        if (!agendamento) return null;

        // Verificar limite de tentativas
        if (agendamento.tentativas >= (agendamento.max_tentativas || 3)) {
            console.log(`[Scheduler] Limite de tentativas atingido para agendamento ${agendamentoId}`);
            return null;
        }

        // Não reagendar se foi respondido
        if (agendamento.respondido) {
            console.log(`[Scheduler] Agendamento ${agendamentoId} foi respondido, não reagendar`);
            return null;
        }

        const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(agendamento.usuario_id);
        if (!usuario) return null;

        // Calcular novo horário baseado nos padrões do usuário
        const patterns = analyzeUserTimePatterns(agendamento.usuario_id);

        // Próxima tentativa em horário diferente
        const tentativasFeitas = agendamento.tentativas + 1;
        const horasDelay = [4, 8, 24][tentativasFeitas - 1] || 24;

        const novoHorario = new Date();
        novoHorario.setHours(novoHorario.getHours() + horasDelay);

        // Se temos padrões, ajustar para horário preferido
        if (patterns.hasEnoughData) {
            // Tentar um horário diferente do original
            const horasAlternativas = [
                patterns.preferredHour,
                (patterns.preferredHour + 2) % 24,
                (patterns.preferredHour + 4) % 24
            ];

            const novaHora = horasAlternativas[tentativasFeitas - 1] || patterns.preferredHour;

            const ajustado = new Date(novoHorario);
            ajustado.setHours(novaHora, 0, 0, 0);

            if (ajustado > novoHorario) {
                novoHorario.setTime(ajustado.getTime());
            }
        }

        // Respeitar quiet hours
        if (isInQuietHours(novoHorario)) {
            const quiet = config?.SCHEDULER_CONFIG?.quietHours;
            if (quiet) {
                novoHorario.setHours(quiet.end, 0, 0, 0);
                if (novoHorario <= new Date()) {
                    novoHorario.setDate(novoHorario.getDate() + 1);
                }
            }
        }

        // Gerar mensagem ligeiramente diferente
        const mensagemOriginal = agendamento.mensagem;
        const prefixos = [
            '',
            'Oi de novo! ',
            'Pensei em você... '
        ];
        const novaMensagem = prefixos[tentativasFeitas - 1] + mensagemOriginal;

        // Criar novo agendamento
        const novoAgendamento = addAgendamento({
            usuarioId: agendamento.usuario_id,
            tipo: agendamento.tipo,
            dataHora: novoHorario.toISOString(),
            mensagem: novaMensagem
        });

        // Copiar contexto e incrementar tentativas
        db.prepare(`
            UPDATE agendamentos
            SET tentativas = ?, contexto = ?, subtipo = ?
            WHERE id = ?
        `).run(tentativasFeitas, agendamento.contexto, 'retry', novoAgendamento.id);

        console.log(`[Scheduler] Smart retry agendado: tentativa ${tentativasFeitas} para ${novoHorario.toISOString()}`);

        return novoAgendamento;

    } catch (error) {
        console.error('[Scheduler] Error in smart retry:', error.message);
        return null;
    }
}

/**
 * Verifica agendamentos não respondidos e aplica smart retry
 */
async function checkUnrespondedMessages() {
    try {
        // Buscar mensagens enviadas há mais de 24h sem resposta
        const agendamentos = db.prepare(`
            SELECT * FROM agendamentos
            WHERE enviado = 1
            AND respondido = 0
            AND tentativas < COALESCE(max_tentativas, 3)
            AND datetime(data_hora) <= datetime('now', '-24 hours')
        `).all();

        for (const agendamento of agendamentos) {
            await smartRetry(agendamento.id);
            await sleep(1000);
        }

    } catch (error) {
        console.error('[Scheduler] Error checking unresponded messages:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// FUNCOES EXISTENTES (MANTIDAS)
// ═══════════════════════════════════════════════════════════════

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

        // Generate contextual message if not provided
        const mensagem = message || await generateContextualFollowUp(userId);

        // Save to database
        const agendamento = addAgendamento({
            usuarioId: userId,
            tipo: 'followup',
            dataHora,
            mensagem
        });

        const localDate = new Date(dataHora);
        const localPreview = formatLocal(localDate);

        console.log(`[Scheduler] Follow-up scheduled for ${phone} at ${dataHora} (local ${localPreview})`);
        console.log(`[Scheduler] Message preview: ${mensagem.substring(0, 50)}...`);

        scheduleNudge(dataHora);

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

    if (!sendMessageFunction) {
        console.warn('[Scheduler] sendMessageFunction not set, skipping check');
        return { status: 'no_sender', sent: 0, errors: 0 };
    }

    if (isInQuietHours()) {
        console.log('[Scheduler] Within quiet hours, follow-ups will wait for janela livre');
        return { status: 'quiet_hours', sent: 0, errors: 0 };
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

                // Send message using retry mechanism
                const sendResult = await sendWithRetry(telefone, mensagem);

                if (sendResult.success) {
                    // Mark as sent in database
                    marcarAgendamentoEnviado(id);

                    sentCount++;
                    results.push({
                        id,
                        phone: telefone,
                        status: 'sent',
                        attempts: sendResult.attempts,
                        sentAt: new Date().toISOString()
                    });

                    console.log(`[Scheduler] Follow-up sent successfully to ${telefone} (${sendResult.attempts} tentativa(s))`);
                } else {
                    throw new Error(`Falha após ${sendResult.attempts} tentativas`);
                }

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

        // Verificar mensagens não respondidas para smart retry
        await checkUnrespondedMessages();

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

    if (nudgeTimeout) {
        clearTimeout(nudgeTimeout);
        nudgeTimeout = null;
    }

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
    const versiculoStats = db.prepare(`
        SELECT COUNT(*) as total FROM usuarios WHERE versiculo_diario_ativo = 1
    `).get();

    return {
        initialized: isInitialized,
        activeJobs: Array.from(cronJobs.keys()),
        pendingFollowUps: getAgendamentosPendentes().length,
        dailyVerseSubscribers: versiculoStats?.total || 0
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

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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

/**
 * Format date in the configured timezone for readable logs
 */
function formatLocal(date) {
    try {
        return date.toLocaleString('pt-BR', { timeZone: TIMEZONE });
    } catch (e) {
        return date.toString();
    }
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(date = new Date()) {
    const quiet = config?.SCHEDULER_CONFIG?.quietHours;
    if (!config?.SCHEDULER_CONFIG?.respectQuietHours || !quiet) return false;

    const start = quiet.start;
    const end = quiet.end;
    const hour = date.getHours();

    if (typeof start !== 'number' || typeof end !== 'number') return false;

    // Quiet window without wrapping midnight
    if (start < end) {
        return hour >= start && hour < end;
    }

    // Quiet window that wraps past midnight (e.g., 22 -> 8)
    return hour >= start || hour < end;
}

/**
 * Schedule a near-term check when a follow-up is due soon
 */
function scheduleNudge(targetTime) {
    if (!targetTime) return;
    const targetMs = new Date(targetTime).getTime();
    if (Number.isNaN(targetMs)) return;

    const delay = Math.max(1000, targetMs - Date.now());
    const limitedDelay = Math.min(delay, CHECK_INTERVAL_MS);

    if (nudgeTimeout) {
        clearTimeout(nudgeTimeout);
    }

    nudgeTimeout = setTimeout(async () => {
        nudgeTimeout = null;
        try {
            await checkPendingFollowUps();
        } catch (err) {
            console.error('[Scheduler] Nudge check failed:', err.message);
        }
    }, limitedDelay);
}

// ═══════════════════════════════════════════════════════════════
// INTEGRACOES PARA USO NO INDEX.JS
// ═══════════════════════════════════════════════════════════════

/**
 * Processa mensagem do usuário e executa ações automáticas do scheduler
 * Deve ser chamado no index.js após receber mensagem
 * @param {string} telefone - Telefone do usuário
 * @param {string} mensagem - Mensagem recebida
 */
export function processUserMessage(telefone, mensagem) {
    // Registrar horário da mensagem
    recordMessageTime(telefone);

    // Marcar que usuário respondeu (para smart retry)
    markUserResponded(telefone);

    // Salvar último assunto
    saveLastTopic(telefone, mensagem);

    // Detectar aniversário mencionado
    detectAndSaveBirthday(telefone, mensagem);

    // Registrar primeira conversa
    recordFirstConversation(telefone);

    // Detectar crise e agendar check-in
    detectCrisisAndScheduleCheckIn(telefone, mensagem);
}

/**
 * Agenda follow-up inteligente para o usuário
 * Usa padrões de horário detectados
 * @param {string} telefone - Telefone do usuário
 * @param {object} options - Opções (hoursDelay, customMessage)
 */
export async function scheduleSmartFollowUp(telefone, options = {}) {
    const usuario = getUsuario(telefone);
    if (!usuario) {
        console.error('[Scheduler] Usuário não encontrado para follow-up:', telefone);
        return null;
    }

    const bestTime = getBestTimeForUser(usuario.id);

    // Se foi passado um delay em horas, usar
    if (options.hoursDelay) {
        const customTime = new Date();
        customTime.setHours(customTime.getHours() + options.hoursDelay);

        // Mas ainda ajustar para horário preferido se possível
        const patterns = analyzeUserTimePatterns(usuario.id);
        if (patterns.hasEnoughData) {
            customTime.setHours(patterns.preferredHour, 0, 0, 0);
            if (customTime <= new Date()) {
                customTime.setDate(customTime.getDate() + 1);
            }
        }

        return scheduleFollowUp(usuario.id, telefone, customTime, options.customMessage);
    }

    return scheduleFollowUp(usuario.id, telefone, bestTime, options.customMessage);
}

// ═══════════════════════════════════════════════════════════════
// EXPORT DEFAULT
// ═══════════════════════════════════════════════════════════════

export default {
    // Inicialização
    initScheduler,
    stopScheduler,
    getSchedulerStatus,

    // Follow-ups
    scheduleFollowUp,
    scheduleSmartFollowUp,
    checkPendingFollowUps,
    generateFollowUpMessage,
    generateContextualFollowUp,
    scheduleReminder,

    // Padrões de horário
    analyzeUserTimePatterns,
    getBestTimeForUser,
    recordMessageTime,

    // Datas especiais
    scheduleSpecialDateReminder,
    detectAndSaveBirthday,
    recordFirstConversation,

    // Check-in pós-crise
    scheduleCrisisCheckIn,
    detectCrisisAndScheduleCheckIn,

    // Versículo do dia
    enrollDailyVerse,
    unenrollDailyVerse,
    changeDailyVerseTime,
    getRandomVerse,
    processVerseCommand,

    // Smart retry
    markUserResponded,
    smartRetry,

    // Novos recursos
    sendDailyVerse,
    checkNightFarewell,
    checkSpecialDatesExtended,
    analyzeEmotionalPatterns,
    checkJourneyMilestones,

    // Integração
    processUserMessage,
    saveLastTopic
};
