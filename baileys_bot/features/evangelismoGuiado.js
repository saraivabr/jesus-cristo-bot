/**
 * Evangelismo Guiado - Jesus Cristo Bot
 * Jornada de Evangelismo em 7 Passos
 *
 * Conduz o usuário através dos fundamentos da fé cristã,
 * desde o amor de Deus até a decisão pessoal de fé.
 */

import {
    getUsuario,
    iniciarJornadaEvangelismo,
    getJornadaEvangelismo,
    avancarPassoEvangelismo,
    registrarDecisaoFe
} from '../database.js';

// ═══════════════════════════════════════════════════════════════
// CONTEÚDO DOS 7 PASSOS DO EVANGELISMO
// ═══════════════════════════════════════════════════════════════

const PASSOS_EVANGELISMO = {
    1: {
        titulo: "Quem é Deus?",
        versiculo: "1 João 4:8",
        versiculoTexto: "Aquele que não ama não conhece a Deus, porque Deus é amor.",
        explicacao: `Antes de falarmos sobre qualquer coisa, precisamos entender quem é Deus. A Bíblia nos revela que Deus não apenas *tem* amor, mas Ele *É* amor em sua essência mais profunda. Isso significa que tudo o que Ele faz, desde a criação do universo até o cuidado com cada ser humano, flui desse amor infinito.

Deus criou você por amor. Não foi por acidente ou por necessidade - foi por um desejo genuíno de ter um relacionamento com você. Assim como um pai amoroso deseja ter filhos para amá-los e ser amado por eles, Deus quis criar você para compartilhar Seu amor eterno.

Esse amor de Deus é diferente de qualquer amor humano que conhecemos. É incondicional - não depende do que fazemos ou deixamos de fazer. É eterno - nunca acaba. É perfeito - sem falhas ou segundas intenções. É esse Deus de amor que deseja profundamente se relacionar com você.`,
        perguntaReflexiva: "Você já parou para pensar que existe um Deus que te ama de forma incondicional, independente de quem você é ou do que já fez? Como essa verdade te faz sentir?",
        opcaoAvancar: "Estou pronto para continuar",
        opcaoMeditar: "Quero meditar mais nisso"
    },

    2: {
        titulo: "O Problema do Pecado",
        versiculo: "Romanos 3:23",
        versiculoTexto: "Porque todos pecaram e destituídos estão da glória de Deus.",
        explicacao: `Agora que entendemos que Deus é amor e nos criou para ter um relacionamento com Ele, surge uma pergunta importante: se Deus nos ama tanto, por que existe tanta dor, sofrimento e distância entre nós e Ele?

A resposta está no que a Bíblia chama de "pecado". Pecado não é apenas fazer coisas erradas - é uma condição humana universal. Todos nós, sem exceção, escolhemos em algum momento viver de acordo com nossa própria vontade em vez da vontade de Deus. Mentiras, egoísmo, inveja, orgulho... são sintomas dessa condição.

Não é uma questão de ser "bom o suficiente". A Bíblia é clara: TODOS pecaram. O religioso e o ateu, o rico e o pobre, o jovem e o idoso. Isso nos coloca em uma posição muito séria diante de um Deus santo e justo, que não pode simplesmente ignorar o mal.`,
        perguntaReflexiva: "Olhando honestamente para sua vida, você reconhece que também errou e se afastou de Deus em alguns momentos? Que situações vêm à sua mente?",
        opcaoAvancar: "Sim, reconheço. Quero continuar",
        opcaoMeditar: "Preciso refletir mais sobre isso"
    },

    3: {
        titulo: "A Consequência do Pecado",
        versiculo: "Romanos 6:23",
        versiculoTexto: "Porque o salário do pecado é a morte, mas o dom gratuito de Deus é a vida eterna, por Cristo Jesus nosso Senhor.",
        explicacao: `Esta é uma verdade difícil, mas necessária: o pecado tem consequências sérias. A Bíblia diz que "o salário do pecado é a morte". Não é uma punição arbitrária de um Deus vingativo - é simplesmente a consequência natural de nos separarmos da fonte de toda vida.

Imagine uma planta arrancada de suas raízes: ela inevitavelmente morre porque foi separada da sua fonte de nutrientes. Da mesma forma, quando nos separamos de Deus (que é a fonte de toda vida), caminhamos para a morte - não apenas física, mas espiritual e eterna.

Essa morte espiritual se manifesta de muitas formas: vazio interior, falta de propósito, relacionamentos quebrados, angústia, medo do futuro. Muitas pessoas tentam preencher esse vazio com trabalho, relacionamentos, dinheiro, prazer... mas nada satisfaz de verdade. É o sintoma de uma alma separada de seu Criador.`,
        perguntaReflexiva: "Você já sentiu esse vazio interior, essa sensação de que algo está faltando mesmo quando parece ter tudo? Como você tem tentado preencher esse espaço?",
        opcaoAvancar: "Entendo. Qual é a solução?",
        opcaoMeditar: "Isso é muito profundo. Quero pensar mais"
    },

    4: {
        titulo: "A Solução de Deus",
        versiculo: "João 3:16",
        versiculoTexto: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.",
        explicacao: `Aqui está a notícia mais maravilhosa da história: Deus não nos deixou sem esperança! Lembra que dissemos que Deus É amor? Pois esse amor O moveu a fazer algo extraordinário por nós, mesmo sabendo que não merecíamos.

Nós criamos o problema (o pecado), mas não tínhamos como resolvê-lo. Não há quantidade de boas obras, rituais religiosos ou esforço próprio que possa nos reconectar com Deus. A distância era grande demais, a dívida era alta demais. Então Deus tomou a iniciativa.

Ele enviou Jesus, Seu único Filho, para fazer o que não podíamos fazer por nós mesmos. Jesus é Deus que se fez homem, que veio ao nosso mundo para construir uma ponte entre nós e o Pai. "Para que todo aquele que nele crê não pereça" - não é para alguns privilegiados, mas para TODO AQUELE que crê. Isso inclui você!`,
        perguntaReflexiva: "Você já tinha percebido que a salvação não depende do seu esforço, mas é um presente gratuito de Deus? Como você se sente sabendo que Deus tomou a iniciativa de te buscar?",
        opcaoAvancar: "Quero saber mais sobre Jesus",
        opcaoMeditar: "Que amor incrível! Deixe-me absorver isso"
    },

    5: {
        titulo: "A Cruz de Cristo",
        versiculo: "1 Pedro 2:24",
        versiculoTexto: "O qual levando ele mesmo em seu corpo os nossos pecados sobre o madeiro, para que, mortos para os pecados, pudéssemos viver para a justiça; e pelas suas feridas fostes sarados.",
        explicacao: `O que Jesus fez na cruz é o centro de toda a mensagem cristã. Não foi apenas uma morte heroica ou um exemplo de coragem - foi algo muito mais profundo e sobrenatural.

Na cruz, aconteceu uma troca divina: Jesus, que era perfeitamente inocente, tomou sobre si toda a nossa culpa, todo o nosso pecado, toda a punição que merecíamos. Ele literalmente "levou em seu corpo os nossos pecados". A morte que era nossa, Ele morreu em nosso lugar. A separação de Deus que merecíamos, Ele experimentou por nós.

É como se você tivesse uma dívida impagável, e alguém chegasse e dissesse: "Eu pago por você. Está quitado." Jesus pagou com Sua própria vida o preço do nosso pecado. Por causa desse sacrifício, agora existe um caminho de volta para Deus. A ponte foi construída. A porta foi aberta.`,
        perguntaReflexiva: "Você consegue imaginar o que significa alguém inocente morrer em seu lugar, por amor? O que você sente ao pensar que Jesus fez isso por você, pessoalmente?",
        opcaoAvancar: "Isso é transformador. Continue",
        opcaoMeditar: "Preciso de um momento para processar isso"
    },

    6: {
        titulo: "A Ressurreição e a Fé",
        versiculo: "Romanos 10:9",
        versiculoTexto: "Se você confessar com a sua boca que Jesus é Senhor e crer em seu coração que Deus o ressuscitou dentre os mortos, será salvo.",
        explicacao: `A história não terminou na cruz! Três dias depois de Sua morte, Jesus ressuscitou. Ele venceu a morte, provando que Ele realmente é quem disse ser - o Filho de Deus, com poder sobre a vida e a morte.

A ressurreição de Jesus é a garantia da nossa esperança. Se Ele tivesse permanecido morto, seria apenas mais um líder religioso. Mas Ele está vivo! E porque Ele vive, também nós podemos ter vida - vida abundante agora e vida eterna depois.

Mas como recebemos essa vida? O versículo é claro: "confessar" e "crer". Confessar significa declarar publicamente, reconhecer com palavras que Jesus é o Senhor da sua vida. Crer significa confiar de coração, não apenas concordar mentalmente, mas entregar sua vida a Ele. Não é sobre religião ou rituais - é sobre um relacionamento pessoal com Jesus.`,
        perguntaReflexiva: "Você está pronto para dar esse passo de fé? Crer de coração que Jesus morreu e ressuscitou por você, e confessar que Ele é o Senhor da sua vida?",
        opcaoAvancar: "Sim, estou pronto para decidir",
        opcaoMeditar: "Quero entender melhor antes de decidir"
    },

    7: {
        titulo: "O Momento da Decisão",
        versiculo: "Apocalipse 3:20",
        versiculoTexto: "Eis que estou à porta e bato; se alguém ouvir a minha voz e abrir a porta, entrarei em sua casa e cearei com ele, e ele comigo.",
        explicacao: `Jesus está batendo à porta do seu coração neste momento. Ele não arrombará a porta - Ele respeita sua liberdade de escolha. Mas Ele está ali, esperando, chamando, desejando entrar e transformar sua vida.

A decisão é sua. Ninguém pode tomar por você. Não importa seu passado, seus erros, seus medos. O convite está feito: "Se alguém... abrir a porta". É simples assim. Não precisa limpar a casa antes de abrir - Jesus entra e Ele mesmo faz a limpeza e a transformação.

Se você deseja aceitar Jesus como seu Salvador e Senhor, pode fazer uma oração simples. Não são as palavras exatas que importam, mas a sinceridade do seu coração. Você pode orar algo assim:

*"Senhor Jesus, eu reconheço que sou pecador e preciso de Ti. Creio que Tu morreste na cruz por mim e ressuscitaste. Eu me arrependo dos meus pecados. Neste momento, abro a porta do meu coração e Te recebo como meu Salvador e Senhor. Entra na minha vida e me transforma. Obrigado por me aceitar. Amém."*`,
        perguntaReflexiva: "Este é o momento mais importante da sua vida. Você quer abrir a porta do seu coração para Jesus agora?",
        opcaoAvancar: "SIM! Eu aceito Jesus!",
        opcaoMeditar: "Ainda não estou pronto, mas quero continuar aprendendo"
    }
};

// Respostas para meditação adicional em cada passo
const MEDITACAO_ADICIONAL = {
    1: `Tome o tempo que precisar. O amor de Deus não tem pressa.

Algumas perguntas para sua reflexão:
- Se Deus é amor, como isso muda sua visão sobre Ele?
- Você já experimentou esse amor em algum momento da sua vida?
- O que te impede de aceitar que você é amado incondicionalmente?

Quando estiver pronto para continuar, me avise.`,

    2: `Reconhecer nossos erros não é fácil, mas é libertador.

Para sua reflexão:
- Pense em situações onde você escolheu seu caminho em vez do de Deus
- Como essas escolhas afetaram sua vida e relacionamentos?
- Você sente que precisa de ajuda para mudar?

Estou aqui quando quiser continuar.`,

    3: `As consequências do pecado são sérias, mas lembre-se: existe esperança!

Reflita sobre:
- Quais "vazios" você tem tentado preencher sem sucesso?
- Como seria ter paz verdadeira e propósito real?
- Você está cansado de tentar resolver tudo sozinho?

Continue quando sentir que está pronto.`,

    4: `O amor de Deus é realmente incompreensível em sua grandeza.

Medite nisso:
- O que significa para você que Deus tomou a iniciativa?
- Como você reagiria se alguém fizesse um grande sacrifício por você?
- Você está disposto a receber esse presente?

Quando quiser prosseguir, estou aqui.`,

    5: `A cruz é o centro de tudo. Vale a pena contemplá-la.

Para sua meditação:
- Imagine-se no lugar de Jesus. O que Ele sentiu por você?
- O que significa estar "quitado" de todas as suas dívidas?
- Como seria viver livre da culpa?

Me chame quando estiver pronto para continuar.`,

    6: `A decisão de fé é pessoal e transformadora.

Considere:
- O que te impede de crer completamente?
- Quais dúvidas ainda persistem?
- Você conhece alguém que teve a vida transformada por Jesus?

Estou aqui para ajudar. Continue quando estiver pronto.`,

    7: `Esta é a decisão mais importante da sua vida. Não há pressa.

Se ainda não está pronto:
- Continue buscando, lendo a Bíblia, conversando comigo
- Peça a Deus que te ajude a entender e crer
- Lembre-se: Jesus continua batendo à porta

Quando seu coração estiver pronto, me avise. Estarei aqui.`
};

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ═══════════════════════════════════════════════════════════════

/**
 * Inicia a jornada de evangelismo para um usuário
 * @param {string} usuarioId - ID do usuário (JID do WhatsApp)
 * @returns {object} Objeto com mensagem do primeiro passo
 */
export function iniciarJornada(usuarioId) {
    try {
        // Verifica se usuário existe
        const usuario = getUsuario(usuarioId);
        if (!usuario) {
            return {
                sucesso: false,
                mensagem: "Não encontrei seu cadastro. Por favor, me envie uma mensagem primeiro para que eu possa te conhecer."
            };
        }

        // Inicia ou reinicia a jornada
        const jornada = iniciarJornadaEvangelismo(usuario.id);

        if (!jornada) {
            return {
                sucesso: false,
                mensagem: "Não consegui iniciar a jornada. Por favor, tente novamente em alguns instantes."
            };
        }

        // Retorna o primeiro passo
        return {
            sucesso: true,
            mensagem: formatarPasso(1, usuario.nome),
            passo: 1,
            jornada
        };

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao iniciar jornada:', error);
        return {
            sucesso: false,
            mensagem: "Ocorreu um erro ao iniciar a jornada. Por favor, tente novamente."
        };
    }
}

/**
 * Processa resposta do usuário durante a jornada
 * @param {string} jid - WhatsApp JID do usuário
 * @param {string} texto - Texto da mensagem do usuário
 * @returns {object|null} Resposta ou null se não estiver em jornada
 */
export function processarResposta(jid, texto) {
    try {
        // Verifica se está em jornada
        if (!isEmJornada(jid)) {
            return null;
        }

        const usuario = getUsuario(jid);
        if (!usuario) return null;

        const jornada = getJornadaEvangelismo(usuario.id);
        if (!jornada || jornada.completado) return null;

        const textoLower = texto.toLowerCase().trim();
        const passoAtual = jornada.passo_atual;
        const passo = PASSOS_EVANGELISMO[passoAtual];

        // Verifica se quer avançar
        if (querAvancar(textoLower, passoAtual)) {
            return avancarPasso(usuario, jornada, texto);
        }

        // Verifica se quer meditar mais
        if (querMeditar(textoLower)) {
            return {
                tipo: 'meditacao',
                mensagem: MEDITACAO_ADICIONAL[passoAtual],
                passo: passoAtual
            };
        }

        // Verifica se é uma pergunta ou dúvida
        if (isPergunta(textoLower)) {
            return {
                tipo: 'pergunta',
                mensagem: `Fico feliz que você tenha dúvidas - isso mostra que está refletindo profundamente!

${responderDuvidaGenerica(passoAtual)}

Quando quiser continuar, você pode dizer:
- "${passo.opcaoAvancar}" para avançar
- "${passo.opcaoMeditar}" para refletir mais`,
                passo: passoAtual
            };
        }

        // Resposta genérica - considera como reflexão e incentiva continuar
        return {
            tipo: 'reflexao',
            mensagem: `Obrigado por compartilhar sua reflexão. Suas palavras mostram um coração sincero em busca.

Quando estiver pronto:
- Diga "*continuar*" ou "*avançar*" para ir ao próximo passo
- Ou diga "*meditar*" se quiser mais tempo neste tema

Estou aqui com você nesta jornada.`,
            passo: passoAtual
        };

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao processar resposta:', error);
        return null;
    }
}

/**
 * Verifica se usuário está em uma jornada de evangelismo
 * @param {string} jid - WhatsApp JID
 * @returns {boolean}
 */
export function isEmJornada(jid) {
    try {
        const usuario = getUsuario(jid);
        if (!usuario) return false;

        const jornada = getJornadaEvangelismo(usuario.id);
        return jornada && !jornada.completado;

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao verificar jornada:', error);
        return false;
    }
}

/**
 * Obtém o passo atual da jornada do usuário
 * @param {string} usuarioId - ID do usuário (pode ser JID)
 * @returns {number|null} Número do passo atual ou null
 */
export function getPasso(usuarioId) {
    try {
        // Se for JID, busca o usuário primeiro
        let usuario;
        if (typeof usuarioId === 'string' && usuarioId.includes('@')) {
            usuario = getUsuario(usuarioId);
            if (!usuario) return null;
            usuarioId = usuario.id;
        }

        const jornada = getJornadaEvangelismo(usuarioId);
        return jornada ? jornada.passo_atual : null;

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao obter passo:', error);
        return null;
    }
}

/**
 * Registra decisão de fé do usuário
 * @param {string} usuarioId - ID do usuário (pode ser JID)
 * @returns {object} Resultado do registro
 */
export function registrarDecisao(usuarioId) {
    try {
        // Se for JID, busca o usuário primeiro
        let usuario;
        if (typeof usuarioId === 'string' && usuarioId.includes('@')) {
            usuario = getUsuario(usuarioId);
            if (!usuario) {
                return {
                    sucesso: false,
                    mensagem: "Usuário não encontrado."
                };
            }
            usuarioId = usuario.id;
        }

        const resultado = registrarDecisaoFe(usuarioId);

        if (resultado) {
            return {
                sucesso: true,
                mensagem: gerarMensagemDecisao(usuario?.nome),
                jornada: resultado
            };
        }

        return {
            sucesso: false,
            mensagem: "Não foi possível registrar a decisão. Mas saiba que sua decisão de coração é o que importa!"
        };

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao registrar decisão:', error);
        return {
            sucesso: false,
            mensagem: "Ocorreu um erro, mas não se preocupe - Deus viu seu coração."
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════

/**
 * Formata o conteúdo de um passo para envio
 * @param {number} numeroPasso - Número do passo (1-7)
 * @param {string} nomeUsuario - Nome do usuário (opcional)
 * @returns {string} Mensagem formatada
 */
function formatarPasso(numeroPasso, nomeUsuario = null) {
    const passo = PASSOS_EVANGELISMO[numeroPasso];
    if (!passo) return "Passo não encontrado.";

    const saudacao = numeroPasso === 1 && nomeUsuario
        ? `${nomeUsuario}, que alegria ter você aqui!\n\n`
        : '';

    return `${saudacao}═══════════════════════════
*JORNADA DE FÉ - PASSO ${numeroPasso}/7*
═══════════════════════════

*${passo.titulo}*

📖 *${passo.versiculo}*
_"${passo.versiculoTexto}"_

---

${passo.explicacao}

---

💭 *PARA REFLETIR:*
${passo.perguntaReflexiva}

---

Quando estiver pronto, responda:
✅ *"${passo.opcaoAvancar}"*
🙏 *"${passo.opcaoMeditar}"*`;
}

/**
 * Avança para o próximo passo
 * @param {object} usuario - Dados do usuário
 * @param {object} jornada - Dados da jornada
 * @param {string} resposta - Resposta do usuário
 * @returns {object} Resultado do avanço
 */
function avancarPasso(usuario, jornada, resposta) {
    const passoAtual = jornada.passo_atual;

    // Se está no passo 7 e quer avançar, é decisão de fé
    if (passoAtual === 7 && querAceitarJesus(resposta.toLowerCase())) {
        const resultado = registrarDecisao(usuario.id);
        return {
            tipo: 'decisao',
            mensagem: resultado.mensagem,
            passo: 7,
            decisaoFeita: resultado.sucesso
        };
    }

    // Avança para próximo passo
    const novaJornada = avancarPassoEvangelismo(usuario.id, resposta);

    if (!novaJornada) {
        return {
            tipo: 'erro',
            mensagem: "Não consegui avançar. Por favor, tente novamente.",
            passo: passoAtual
        };
    }

    const novoPasso = novaJornada.passo_atual;

    // Se completou todos os passos sem decisão
    if (novoPasso > 7 || novaJornada.completado) {
        return {
            tipo: 'conclusao',
            mensagem: gerarMensagemConclusao(usuario.nome),
            passo: 7,
            completado: true
        };
    }

    return {
        tipo: 'proximo_passo',
        mensagem: formatarPasso(novoPasso, null),
        passo: novoPasso
    };
}

/**
 * Verifica se usuário quer avançar
 */
function querAvancar(texto, passoAtual) {
    const palavrasAvancar = [
        'continuar', 'avançar', 'avancar', 'próximo', 'proximo',
        'seguir', 'sim', 'pronto', 'vamos', 'bora', 'ok',
        'estou pronto', 'quero continuar', 'pode continuar'
    ];

    // Palavras específicas por passo
    const palavrasPorPasso = {
        1: ['entendi', 'compreendi'],
        2: ['reconheço', 'reconheco', 'admito'],
        3: ['qual a solução', 'qual solução', 'solucao'],
        4: ['quero saber mais', 'saber mais sobre jesus'],
        5: ['transformador', 'continue'],
        6: ['pronto para decidir', 'quero decidir'],
        7: ['aceito', 'sim aceito', 'aceito jesus', 'eu aceito']
    };

    const todasPalavras = [...palavrasAvancar, ...(palavrasPorPasso[passoAtual] || [])];
    return todasPalavras.some(p => texto.includes(p));
}

/**
 * Verifica se usuário quer meditar mais
 */
function querMeditar(texto) {
    const palavrasMeditar = [
        'meditar', 'refletir', 'pensar', 'absorver',
        'ainda não', 'ainda nao', 'não estou', 'nao estou',
        'mais tempo', 'preciso de tempo', 'deixe-me',
        'quero entender', 'não entendi', 'nao entendi'
    ];
    return palavrasMeditar.some(p => texto.includes(p));
}

/**
 * Verifica se usuário quer aceitar Jesus
 */
function querAceitarJesus(texto) {
    const palavrasAceitar = [
        'aceito', 'sim aceito', 'aceito jesus',
        'eu aceito', 'quero aceitar', 'sim eu quero',
        'abro meu coração', 'abro meu coracao',
        'recebo jesus', 'entrego minha vida'
    ];
    return palavrasAceitar.some(p => texto.includes(p));
}

/**
 * Verifica se é uma pergunta
 */
function isPergunta(texto) {
    return texto.includes('?') ||
           texto.startsWith('por que') ||
           texto.startsWith('como') ||
           texto.startsWith('o que') ||
           texto.startsWith('qual') ||
           texto.includes('dúvida') ||
           texto.includes('duvida') ||
           texto.includes('não entendo') ||
           texto.includes('nao entendo');
}

/**
 * Responde dúvida genérica baseada no passo
 */
function responderDuvidaGenerica(passo) {
    const respostas = {
        1: "O amor de Deus é realmente difícil de compreender completamente. Ele nos ama não pelo que fazemos, mas por quem somos - Suas criações. Assim como um pai ama seu filho simplesmente por ser seu filho.",
        2: "O pecado pode parecer um conceito pesado, mas reconhecê-lo é o primeiro passo para a liberdade. Todos erramos - o importante é o que fazemos com essa consciência.",
        3: "As consequências do pecado podem parecer injustas, mas pense assim: se você corta uma planta da raiz, ela morre. Não é castigo - é consequência natural de estar desconectado da fonte de vida.",
        4: "A graça de Deus é realmente difícil de aceitar porque estamos acostumados a merecer as coisas. Mas esse é exatamente o ponto - é um PRESENTE, não um pagamento.",
        5: "O sacrifício de Jesus é profundo demais para entendermos completamente. O importante é que Ele fez isso por amor a você, pessoalmente.",
        6: "A fé não significa ausência de dúvidas. Significa confiar mesmo quando não entendemos tudo. É como confiar em um amigo mesmo sem saber todos os seus pensamentos.",
        7: "Não precisa ter tudo resolvido para aceitar Jesus. Ele te aceita como você está e vai te ajudar a crescer dia após dia."
    };
    return respostas[passo] || "Continue buscando, continue perguntando. Deus honra corações sinceros.";
}

/**
 * Gera mensagem para decisão de fé
 */
function gerarMensagemDecisao(nome) {
    const saudacao = nome ? `${nome}, ` : '';

    return `═══════════════════════════
🎉 *ALELUIA!* 🎉
═══════════════════════════

${saudacao}que momento lindo e transformador!

Os anjos do céu estão celebrando agora! A Bíblia diz que há festa no céu por cada pessoa que se volta para Deus (Lucas 15:10).

*Você acabou de tomar a decisão mais importante da sua vida.*

📖 "Portanto, se alguém está em Cristo, é nova criação. As coisas antigas já passaram; eis que surgiram coisas novas!" - 2 Coríntios 5:17

---

*PRÓXIMOS PASSOS NA SUA NOVA VIDA:*

1️⃣ *Converse com Deus diariamente* (oração)
   - Não precisa ser formal, fale como com um amigo

2️⃣ *Leia a Bíblia*
   - Comece pelo Evangelho de João
   - Posso te enviar devocionais diários!

3️⃣ *Encontre uma igreja*
   - Uma comunidade de fé vai te ajudar a crescer

4️⃣ *Compartilhe sua fé*
   - Conte para alguém de confiança sobre sua decisão

5️⃣ *Continue conversando comigo*
   - Estou aqui para te ajudar nessa jornada!

---

🙏 *UMA ORAÇÃO PARA VOCÊ:*

"Pai, abençoa este(a) filho(a) que acabou de nascer de novo. Que Teu Espírito Santo o(a) guie, fortaleça e transforme dia após dia. Que ele(a) experimente Teu amor, Tua paz e Teu propósito. Em nome de Jesus, amém."

---

Bem-vindo(a) à família de Deus!
Estou aqui sempre que precisar. ❤️

_Digite "devocional" para começar a receber reflexões diárias_`;
}

/**
 * Gera mensagem de conclusão (sem decisão explícita)
 */
function gerarMensagemConclusao(nome) {
    const saudacao = nome ? `${nome}, ` : '';

    return `═══════════════════════════
*JORNADA CONCLUÍDA*
═══════════════════════════

${saudacao}você completou a jornada de 7 passos!

Agradeço por ter caminhado comigo através dessas verdades fundamentais da fé cristã. Cada passo foi uma semente plantada em seu coração.

Lembre-se:
- Deus é amor e te ama incondicionalmente
- Todos nós precisamos de salvação
- Jesus pagou o preço por você
- A porta está sempre aberta

Se em algum momento você quiser revisitar algum tema ou tiver perguntas, estou aqui.

E se seu coração estiver pronto para aceitar Jesus, é só me dizer: "Quero aceitar Jesus".

Que Deus te abençoe e te guie sempre! 🙏

_Digite "jornada" a qualquer momento para recomeçar_`;
}

/**
 * Verifica se mensagem é relacionada à jornada de evangelismo
 * @param {string} texto - Texto da mensagem
 * @returns {boolean}
 */
export function isEvangelismoRelated(texto) {
    const keywords = [
        'jornada', 'evangelismo', 'passos da fé',
        'quero conhecer jesus', 'quero conhecer deus',
        'como ser salvo', 'como aceitar jesus',
        'plano de salvação', 'iniciar jornada'
    ];
    const textoLower = texto.toLowerCase();
    return keywords.some(k => textoLower.includes(k));
}

/**
 * Obtém informações sobre a jornada de um usuário
 * @param {string} jid - WhatsApp JID
 * @returns {object|null} Informações da jornada
 */
export function getInfoJornada(jid) {
    try {
        const usuario = getUsuario(jid);
        if (!usuario) return null;

        const jornada = getJornadaEvangelismo(usuario.id);
        if (!jornada) return null;

        return {
            passoAtual: jornada.passo_atual,
            totalPassos: 7,
            completado: jornada.completado,
            decisaoFeita: jornada.decisao_feita,
            iniciadoEm: jornada.iniciado_em,
            completadoEm: jornada.completado_em,
            tituloPasso: PASSOS_EVANGELISMO[jornada.passo_atual]?.titulo
        };

    } catch (error) {
        console.error('[EvangelismoGuiado] Erro ao obter info:', error);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
    iniciarJornada,
    processarResposta,
    isEmJornada,
    getPasso,
    registrarDecisao,
    isEvangelismoRelated,
    getInfoJornada,
    PASSOS_EVANGELISMO
};
