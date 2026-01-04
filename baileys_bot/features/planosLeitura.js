/**
 * Planos de Leitura Bíblica - Jesus Cristo Bot
 * Sistema de planos de leitura com acompanhamento diário
 */

import * as db from '../database.js';

// ═══════════════════════════════════════════════════════════════
// PLANOS DE LEITURA PREDEFINIDOS
// ═══════════════════════════════════════════════════════════════

const PLANOS = {
    fundamentos: {
        nome: 'Fundamentos da Fé',
        descricao: 'Uma jornada de 21 dias pelos fundamentos da fé cristã',
        duracao: 21,
        dias: [
            { dia: 1, titulo: 'No princípio', leitura: 'Gênesis 1:1-31', reflexao: 'Deus é o criador de tudo. Você faz parte de Sua criação especial.' },
            { dia: 2, titulo: 'Criados à imagem de Deus', leitura: 'Gênesis 1:26-31; 2:7', reflexao: 'Você foi feito à imagem de Deus, com propósito e valor.' },
            { dia: 3, titulo: 'A queda', leitura: 'Gênesis 3:1-24', reflexao: 'O pecado entrou no mundo, mas Deus já tinha um plano de resgate.' },
            { dia: 4, titulo: 'A promessa', leitura: 'Gênesis 12:1-9', reflexao: 'Deus faz promessas e as cumpre. Confie nEle.' },
            { dia: 5, titulo: 'Os Dez Mandamentos', leitura: 'Êxodo 20:1-17', reflexao: 'A lei de Deus nos mostra Seu caráter e Seus caminhos.' },
            { dia: 6, titulo: 'O Bom Pastor', leitura: 'Salmo 23', reflexao: 'O Senhor cuida de você como um pastor cuida de suas ovelhas.' },
            { dia: 7, titulo: 'Dia de descanso', leitura: 'Salmo 46', reflexao: 'Aquiete-se e saiba que Ele é Deus. Descanse nEle hoje.' },
            { dia: 8, titulo: 'O amor de Deus', leitura: 'João 3:1-21', reflexao: 'Deus amou o mundo de tal maneira que deu Seu Filho único.' },
            { dia: 9, titulo: 'Jesus, o Pão da Vida', leitura: 'João 6:25-59', reflexao: 'Jesus é o alimento que satisfaz a alma eternamente.' },
            { dia: 10, titulo: 'A Luz do mundo', leitura: 'João 8:12-30', reflexao: 'Jesus ilumina nosso caminho nas trevas.' },
            { dia: 11, titulo: 'O Bom Pastor', leitura: 'João 10:1-18', reflexao: 'Jesus deu Sua vida pelas ovelhas. Você é uma delas.' },
            { dia: 12, titulo: 'A ressurreição e a vida', leitura: 'João 11:17-44', reflexao: 'Jesus tem poder sobre a morte. Nada é impossível para Ele.' },
            { dia: 13, titulo: 'O caminho, a verdade e a vida', leitura: 'João 14:1-14', reflexao: 'Só através de Jesus chegamos ao Pai.' },
            { dia: 14, titulo: 'Dia de reflexão', leitura: 'Mateus 11:28-30', reflexao: 'Venha a Jesus com seus fardos. Ele dará descanso.' },
            { dia: 15, titulo: 'A cruz', leitura: 'Lucas 23:26-49', reflexao: 'Jesus carregou nossos pecados na cruz por amor.' },
            { dia: 16, titulo: 'A ressurreição', leitura: 'Lucas 24:1-12', reflexao: 'Ele está vivo! A morte não pôde segurá-Lo.' },
            { dia: 17, titulo: 'A ascensão', leitura: 'Atos 1:1-11', reflexao: 'Jesus voltará. Vivemos na esperança de Sua volta.' },
            { dia: 18, titulo: 'O Espírito Santo', leitura: 'Atos 2:1-21', reflexao: 'O Espírito Santo habita em nós e nos capacita.' },
            { dia: 19, titulo: 'Salvos pela graça', leitura: 'Efésios 2:1-10', reflexao: 'Somos salvos pela graça, não por obras. É um presente!' },
            { dia: 20, titulo: 'A armadura de Deus', leitura: 'Efésios 6:10-20', reflexao: 'Estamos em uma batalha espiritual. Vista-se para ela.' },
            { dia: 21, titulo: 'Nova criatura', leitura: '2 Coríntios 5:14-21', reflexao: 'Em Cristo, você é uma nova criação. O velho já passou!' }
        ]
    },
    salmos_conforto: {
        nome: 'Salmos de Conforto',
        descricao: '30 dias de consolo e esperança através dos Salmos',
        duracao: 30,
        dias: [
            { dia: 1, titulo: 'O justo e o ímpio', leitura: 'Salmo 1', reflexao: 'Medite na Palavra dia e noite.' },
            { dia: 2, titulo: 'Refúgio em Deus', leitura: 'Salmo 2', reflexao: 'Felizes os que nEle se refugiam.' },
            { dia: 3, titulo: 'Quando o medo vem', leitura: 'Salmo 3', reflexao: 'O Senhor é escudo ao redor de mim.' },
            { dia: 4, titulo: 'Paz para dormir', leitura: 'Salmo 4', reflexao: 'Em paz me deito e logo adormeço, porque só Tu, Senhor, me fazes habitar em segurança.' },
            { dia: 5, titulo: 'De manhã', leitura: 'Salmo 5', reflexao: 'De manhã, Senhor, ouves a minha voz.' },
            { dia: 6, titulo: 'Na angústia', leitura: 'Salmo 6', reflexao: 'O Senhor ouviu meu choro.' },
            { dia: 7, titulo: 'Dia de descanso', leitura: 'Salmo 8', reflexao: 'Ó Senhor, quão magnífico é o Teu nome em toda a terra!' },
            { dia: 8, titulo: 'Cântico de louvor', leitura: 'Salmo 9', reflexao: 'Darei graças ao Senhor de todo o meu coração.' },
            { dia: 9, titulo: 'Quando parece que Deus está longe', leitura: 'Salmo 10', reflexao: 'Deus não esquece os que sofrem.' },
            { dia: 10, titulo: 'Confiança no Senhor', leitura: 'Salmo 11', reflexao: 'No Senhor me refugio.' },
            { dia: 11, titulo: 'Palavras puras', leitura: 'Salmo 12', reflexao: 'As palavras do Senhor são puras como prata refinada.' },
            { dia: 12, titulo: 'Até quando?', leitura: 'Salmo 13', reflexao: 'Confiarei na Tua misericórdia.' },
            { dia: 13, titulo: 'O insensato', leitura: 'Salmo 14', reflexao: 'Deus olha dos céus sobre os filhos dos homens.' },
            { dia: 14, titulo: 'Quem pode habitar?', leitura: 'Salmo 15', reflexao: 'O que anda em integridade permanece para sempre.' },
            { dia: 15, titulo: 'Preserva-me', leitura: 'Salmo 16', reflexao: 'Na Tua presença há plenitude de alegria.' },
            { dia: 16, titulo: 'Oração por proteção', leitura: 'Salmo 17', reflexao: 'Guarda-me como a menina dos olhos.' },
            { dia: 17, titulo: 'O Senhor é minha rocha', leitura: 'Salmo 18:1-19', reflexao: 'Ele me tirou das muitas águas.' },
            { dia: 18, titulo: 'Os céus declaram', leitura: 'Salmo 19', reflexao: 'A lei do Senhor é perfeita.' },
            { dia: 19, titulo: 'O Senhor responda', leitura: 'Salmo 20', reflexao: 'Alguns confiam em carros, mas nós no nome do Senhor.' },
            { dia: 20, titulo: 'Força do rei', leitura: 'Salmo 21', reflexao: 'O rei se alegra na Tua força.' },
            { dia: 21, titulo: 'Dia de reflexão', leitura: 'Salmo 22', reflexao: 'Deus meu, Deus meu... - O salmo da cruz.' },
            { dia: 22, titulo: 'O Bom Pastor', leitura: 'Salmo 23', reflexao: 'O Senhor é meu pastor; nada me faltará.' },
            { dia: 23, titulo: 'O Rei da glória', leitura: 'Salmo 24', reflexao: 'Quem é o Rei da glória? O Senhor forte e poderoso.' },
            { dia: 24, titulo: 'A Ti, Senhor', leitura: 'Salmo 25', reflexao: 'Ensina-me os Teus caminhos.' },
            { dia: 25, titulo: 'Integridade', leitura: 'Salmo 26', reflexao: 'Examina-me, Senhor.' },
            { dia: 26, titulo: 'O Senhor é minha luz', leitura: 'Salmo 27', reflexao: 'A quem temerei?' },
            { dia: 27, titulo: 'Minha força', leitura: 'Salmo 28', reflexao: 'O Senhor é minha força e meu escudo.' },
            { dia: 28, titulo: 'A voz do Senhor', leitura: 'Salmo 29', reflexao: 'A voz do Senhor é poderosa.' },
            { dia: 29, titulo: 'Choro à noite, alegria pela manhã', leitura: 'Salmo 30', reflexao: 'O choro pode durar uma noite, mas a alegria vem pela manhã.' },
            { dia: 30, titulo: 'Em Tuas mãos', leitura: 'Salmo 31', reflexao: 'Nas Tuas mãos entrego meu espírito.' }
        ]
    },
    novo_crente: {
        nome: 'Primeiros Passos',
        descricao: '14 dias para novos crentes começarem sua jornada de fé',
        duracao: 14,
        dias: [
            { dia: 1, titulo: 'Você é filho de Deus', leitura: 'João 1:12-13; 1 João 3:1-2', reflexao: 'Ao receber Jesus, você se tornou filho de Deus. Isso é real!' },
            { dia: 2, titulo: 'Salvação garantida', leitura: 'Romanos 10:9-13; João 10:28-29', reflexao: 'Sua salvação está segura nas mãos de Jesus.' },
            { dia: 3, titulo: 'Nova criatura', leitura: '2 Coríntios 5:17; Colossenses 3:1-4', reflexao: 'O velho passou, o novo chegou!' },
            { dia: 4, titulo: 'O Espírito Santo em você', leitura: 'João 14:16-17; Romanos 8:9-11', reflexao: 'O Espírito de Deus agora habita em você.' },
            { dia: 5, titulo: 'Como orar', leitura: 'Mateus 6:5-15; Filipenses 4:6-7', reflexao: 'Fale com Deus como um filho fala com seu Pai.' },
            { dia: 6, titulo: 'A importância da Bíblia', leitura: '2 Timóteo 3:16-17; Salmo 119:105', reflexao: 'A Bíblia é a Palavra de Deus para você.' },
            { dia: 7, titulo: 'Dia de descanso', leitura: 'Mateus 11:28-30', reflexao: 'Descanse em Jesus. Você não precisa se esforçar para ser aceito.' },
            { dia: 8, titulo: 'Perdão dos pecados', leitura: '1 João 1:9; Salmo 103:10-12', reflexao: 'Quando você peca, confesse e receba perdão.' },
            { dia: 9, titulo: 'Vencendo a tentação', leitura: '1 Coríntios 10:13; Tiago 4:7', reflexao: 'Você tem poder para resistir à tentação.' },
            { dia: 10, titulo: 'A igreja', leitura: 'Hebreus 10:24-25; Atos 2:42-47', reflexao: 'Você não foi chamado para caminhar sozinho.' },
            { dia: 11, titulo: 'Batismo', leitura: 'Mateus 28:19; Romanos 6:3-4', reflexao: 'O batismo é um testemunho público da sua fé.' },
            { dia: 12, titulo: 'Compartilhando sua fé', leitura: '1 Pedro 3:15; Mateus 5:14-16', reflexao: 'Sua vida e suas palavras podem apontar outros para Jesus.' },
            { dia: 13, titulo: 'Crescendo na fé', leitura: '2 Pedro 3:18; Colossenses 2:6-7', reflexao: 'A vida cristã é uma jornada de crescimento.' },
            { dia: 14, titulo: 'A grande comissão', leitura: 'Mateus 28:18-20; Atos 1:8', reflexao: 'Você faz parte da missão de Deus no mundo!' }
        ]
    }
};

/**
 * Inicializa os planos de leitura no banco de dados
 * @returns {array} Planos criados
 */
export async function inicializarPlanos() {
    const planosExistentes = db.getPlanosLeitura();

    if (planosExistentes.length > 0) {
        console.log('[PlanosLeitura] Planos já existem no banco');
        return planosExistentes;
    }

    console.log('[PlanosLeitura] Inicializando planos de leitura...');

    const planosCriados = [];

    for (const [key, plano] of Object.entries(PLANOS)) {
        const criado = db.createPlanoLeitura(
            plano.nome,
            plano.descricao,
            plano.duracao,
            plano.dias
        );

        if (criado) {
            planosCriados.push(criado);
            console.log(`[PlanosLeitura] Plano "${plano.nome}" criado`);
        }
    }

    return planosCriados;
}

/**
 * Lista planos disponíveis para o usuário escolher
 * @returns {string} Mensagem formatada com os planos
 */
export function listarPlanos() {
    const planos = db.getPlanosLeitura();

    if (planos.length === 0) {
        return 'Ainda estamos preparando os planos de leitura. Volte em breve!';
    }

    let mensagem = '📖 *Planos de Leitura Disponíveis*\n\n';

    planos.forEach((plano, i) => {
        mensagem += `*${i + 1}. ${plano.nome}*\n`;
        mensagem += `   📅 ${plano.duracao_dias} dias\n`;
        mensagem += `   ${plano.descricao}\n\n`;
    });

    mensagem += 'Responda com o número do plano para começar';

    return mensagem;
}

/**
 * Inicia um plano para o usuário
 * @param {number} usuarioId - ID do usuário
 * @param {number} planoIndice - Índice do plano (1-based)
 * @returns {object} Resultado
 */
export function iniciarPlano(usuarioId, planoIndice) {
    const planos = db.getPlanosLeitura();

    if (planoIndice < 1 || planoIndice > planos.length) {
        return {
            sucesso: false,
            mensagem: 'Plano inválido. Use "planos de leitura" para ver as opções.'
        };
    }

    const plano = planos[planoIndice - 1];
    const progresso = db.iniciarPlanoUsuario(usuarioId, plano.id);

    if (!progresso) {
        return {
            sucesso: false,
            mensagem: 'Não consegui iniciar o plano. Tente novamente.'
        };
    }

    const leituraHoje = getLeituraDoDia(progresso);

    return {
        sucesso: true,
        mensagem: `🎉 *Plano "${plano.nome}" iniciado!*\n\nVocê está no Dia 1 de ${plano.duracao_dias}.\n\n${formatarLeitura(leituraHoje)}\n\n_Quando terminar, responda "li" para avançar_`
    };
}

/**
 * Obtém a leitura do dia atual
 * @param {object} progresso - Dados do progresso
 * @returns {object} Leitura do dia
 */
function getLeituraDoDia(progresso) {
    const conteudo = progresso.conteudo;
    const diaAtual = progresso.dia_atual;

    if (diaAtual > conteudo.length) {
        return conteudo[conteudo.length - 1];
    }

    return conteudo[diaAtual - 1];
}

/**
 * Formata a leitura para envio
 * @param {object} leitura - Dados da leitura
 * @returns {string} Leitura formatada
 */
function formatarLeitura(leitura) {
    return `📖 *Dia ${leitura.dia}: ${leitura.titulo}*

📜 *Leitura:* ${leitura.leitura}

💭 *Reflexão:* ${leitura.reflexao}`;
}

/**
 * Envia leitura do dia para usuários com plano ativo
 * @param {function} sendFunction - Função para enviar mensagem
 * @returns {object} Resultado do envio
 */
export async function enviarLeituraDoDia(sendFunction) {
    const usuarios = db.getUsuariosPlanoAtivo();
    const resultados = { enviados: 0, erros: 0 };

    console.log(`[PlanosLeitura] Enviando leitura para ${usuarios.length} usuários`);

    for (const usuario of usuarios) {
        try {
            const progresso = db.getPlanoAtivo(usuario.id);
            if (!progresso) continue;

            const leitura = getLeituraDoDia(progresso);
            const mensagem = `Bom dia${usuario.nome ? ', ' + usuario.nome : ''}! 🌅\n\n${formatarLeitura(leitura)}\n\n_Progresso: Dia ${progresso.dia_atual} de ${progresso.duracao_dias}_\n_Responda "li" quando terminar_`;

            await sendFunction(usuario.telefone, mensagem);
            resultados.enviados++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`[PlanosLeitura] Erro ao enviar para ${usuario.telefone}:`, error);
            resultados.erros++;
        }
    }

    console.log(`[PlanosLeitura] Envio concluído: ${resultados.enviados} enviados`);
    return resultados;
}

/**
 * Processa resposta do usuário sobre a leitura
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da resposta
 * @returns {object|null} Resultado ou null
 */
export function processarRespostaLeitura(jid, texto) {
    const usuario = db.getUsuario(jid);
    if (!usuario) return null;

    const progresso = db.getPlanoAtivo(usuario.id);
    if (!progresso) return null;

    const textoLower = texto.toLowerCase().trim();

    // Marcar como lida e avançar
    if (textoLower === 'li' || textoLower === 'lido' || textoLower === 'concluído' || textoLower === 'feito') {
        const novoProgresso = db.avancarDiaPlano(usuario.id, progresso.plano_id);

        if (!novoProgresso) {
            return {
                tipo: 'erro',
                mensagem: 'Não consegui atualizar seu progresso. Tente novamente.'
            };
        }

        // Verificar se completou
        if (novoProgresso.completado_em) {
            return {
                tipo: 'completado',
                mensagem: `🎉 *Parabéns!* 🎉\n\nVocê completou o plano "${novoProgresso.nome}"!\n\nQue as verdades que você aprendeu transformem sua vida. Continue firme na Palavra!\n\n_Para começar um novo plano, diga "planos de leitura"_`
            };
        }

        // Próxima leitura
        const proximaLeitura = getLeituraDoDia(novoProgresso);

        return {
            tipo: 'avancou',
            mensagem: `✅ Leitura concluída! Você está progredindo!\n\n*Amanhã você receberá:*\n${formatarLeitura(proximaLeitura)}\n\n_Progresso: Dia ${novoProgresso.dia_atual} de ${novoProgresso.duracao_dias}_`
        };
    }

    // Pular leitura
    if (textoLower === 'pulei' || textoLower === 'pular') {
        const novoProgresso = db.avancarDiaPlano(usuario.id, progresso.plano_id);

        return {
            tipo: 'pulou',
            mensagem: `Ok, não tem problema. Amanhã temos uma nova oportunidade!\n\n_Progresso: Dia ${novoProgresso.dia_atual} de ${novoProgresso.duracao_dias}_`
        };
    }

    // Ver leitura atual
    if (textoLower.includes('leitura de hoje') || textoLower.includes('leitura do dia')) {
        const leitura = getLeituraDoDia(progresso);
        return {
            tipo: 'leitura',
            mensagem: `${formatarLeitura(leitura)}\n\n_Progresso: Dia ${progresso.dia_atual} de ${progresso.duracao_dias}_`
        };
    }

    // Pausar plano
    if (textoLower.includes('pausar plano') || textoLower.includes('parar plano')) {
        db.db.prepare('UPDATE usuario_planos SET pausado = 1 WHERE usuario_id = ? AND plano_id = ?')
            .run(usuario.id, progresso.plano_id);
        db.db.prepare('UPDATE usuarios SET plano_leitura_ativo = 0 WHERE id = ?').run(usuario.id);

        return {
            tipo: 'pausado',
            mensagem: 'Plano pausado. Quando quiser continuar, é só dizer "continuar plano"!'
        };
    }

    return null;
}

/**
 * Continua um plano pausado
 * @param {number} usuarioId - ID do usuário
 * @returns {object} Resultado
 */
export function continuarPlano(usuarioId) {
    try {
        const stmt = db.db.prepare(`
            SELECT up.*, pl.nome, pl.duracao_dias, pl.conteudo
            FROM usuario_planos up
            JOIN planos_leitura pl ON up.plano_id = pl.id
            WHERE up.usuario_id = ? AND up.pausado = 1 AND up.completado_em IS NULL
            ORDER BY up.iniciado_em DESC
            LIMIT 1
        `);

        const plano = stmt.get(usuarioId);

        if (!plano) {
            return {
                sucesso: false,
                mensagem: 'Você não tem planos pausados. Use "planos de leitura" para começar um novo!'
            };
        }

        // Reativar
        db.db.prepare('UPDATE usuario_planos SET pausado = 0 WHERE id = ?').run(plano.id);
        db.db.prepare('UPDATE usuarios SET plano_leitura_ativo = 1 WHERE id = ?').run(usuarioId);

        const conteudo = JSON.parse(plano.conteudo);
        plano.conteudo = conteudo;
        const leitura = getLeituraDoDia(plano);

        return {
            sucesso: true,
            mensagem: `Bem-vindo de volta! 🙌\n\nContinuando "${plano.nome}":\n\n${formatarLeitura(leitura)}\n\n_Progresso: Dia ${plano.dia_atual} de ${plano.duracao_dias}_`
        };

    } catch (error) {
        return {
            sucesso: false,
            mensagem: 'Erro ao continuar o plano. Tente novamente.'
        };
    }
}

/**
 * Verifica se mensagem é relacionada a planos
 * @param {string} texto - Texto da mensagem
 * @returns {boolean}
 */
export function isPlanoRelated(texto) {
    const keywords = [
        'plano de leitura', 'planos de leitura', 'leitura bíblica',
        'li', 'lido', 'pulei', 'pausar plano', 'continuar plano',
        'leitura de hoje', 'leitura do dia'
    ];
    const textoLower = texto.toLowerCase();
    return keywords.some(k => textoLower.includes(k) || textoLower === k);
}

/**
 * Processa mensagem relacionada a planos
 * @param {string} jid - WhatsApp JID
 * @param {string} texto - Texto da mensagem
 * @returns {object|null} Resposta ou null
 */
export async function processarMensagemPlano(jid, texto) {
    const usuario = db.getUsuario(jid);
    if (!usuario) return null;

    const textoLower = texto.toLowerCase();

    // Listar planos
    if (textoLower.includes('plano de leitura') || textoLower.includes('planos de leitura')) {
        // Inicializa planos se necessário
        await inicializarPlanos();
        return {
            tipo: 'lista',
            mensagem: listarPlanos()
        };
    }

    // Continuar plano pausado
    if (textoLower.includes('continuar plano')) {
        return continuarPlano(usuario.id);
    }

    // Escolher plano (número)
    const match = textoLower.match(/^[1-3]$/);
    if (match) {
        // Verifica se está no contexto de escolher plano
        const planoAtivo = db.getPlanoAtivo(usuario.id);
        if (!planoAtivo) {
            return iniciarPlano(usuario.id, parseInt(match[0]));
        }
    }

    // Processar resposta de leitura
    return processarRespostaLeitura(jid, texto);
}

export default {
    inicializarPlanos,
    listarPlanos,
    iniciarPlano,
    enviarLeituraDoDia,
    processarRespostaLeitura,
    continuarPlano,
    isPlanoRelated,
    processarMensagemPlano
};
