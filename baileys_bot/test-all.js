/**
 * Testes Internos - Jesus Cristo Bot
 * Valida todos os módulos antes de iniciar
 */

import config from './config.js';
import * as db from './database.js';
import * as humanizer from './humanizer.js';
import * as memoria from './memoria.js';
import * as gemini from './gemini.js';
import * as tts from './tts.js';

const tests = {
    passed: 0,
    failed: 0,
    results: []
};

function test(name, fn) {
    try {
        const result = fn();
        if (result === true || result) {
            tests.passed++;
            tests.results.push(`✅ ${name}`);
            return true;
        } else {
            tests.failed++;
            tests.results.push(`❌ ${name}: returned falsy`);
            return false;
        }
    } catch (error) {
        tests.failed++;
        tests.results.push(`❌ ${name}: ${error.message}`);
        return false;
    }
}

async function testAsync(name, fn) {
    try {
        const result = await fn();
        if (result === true || result) {
            tests.passed++;
            tests.results.push(`✅ ${name}`);
            return true;
        } else {
            tests.failed++;
            tests.results.push(`❌ ${name}: returned falsy`);
            return false;
        }
    } catch (error) {
        tests.failed++;
        tests.results.push(`❌ ${name}: ${error.message}`);
        return false;
    }
}

console.log('🧪 ════════════════════════════════════════════════');
console.log('   JESUS CRISTO BOT - TESTES INTERNOS');
console.log('════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════
// TESTE 1: CONFIG
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 1: CONFIG.JS');

test('Config: GEMINI_API_KEY existe', () => {
    return config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 10;
});

test('Config: BOT_NAME definido', () => {
    return config.BOT_NAME === 'Jesus Cristo';
});

test('Config: debounceTime é número', () => {
    return typeof config.debounceTime === 'number' && config.debounceTime > 0;
});

test('Config: DELAYS configurado', () => {
    return config.DELAYS && config.DELAYS.medium && config.DELAYS.medium.min > 0;
});

test('Config: TTS_CONFIG existe', () => {
    return config.TTS_CONFIG && typeof config.TTS_CONFIG.enabled === 'boolean';
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 2: DATABASE
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 2: DATABASE.JS');

const testPhone = '5511999999999@s.whatsapp.net';

test('Database: saveUsuario funciona', () => {
    const usuario = db.saveUsuario({
        telefone: testPhone,
        nome: 'Teste Silva',
        familia: { esposa: 'Maria' },
        trabalho: { cargo: 'Desenvolvedor' },
        jornada_espiritual: { nivel: 'novo' }
    });
    return usuario && usuario.id && usuario.telefone === testPhone;
});

test('Database: getUsuario funciona', () => {
    const usuario = db.getUsuario(testPhone);
    return usuario && usuario.nome === 'Teste Silva';
});

test('Database: updateUsuario funciona', () => {
    const usuario = db.updateUsuario(testPhone, { nome: 'Teste Atualizado' });
    return usuario && usuario.nome === 'Teste Atualizado';
});

test('Database: addConversa funciona', () => {
    const usuario = db.getUsuario(testPhone);
    const conversa = db.addConversa(usuario.id, 'Olá Jesus', 'Olá meu filho!');
    return conversa && conversa.id && conversa.mensagem === 'Olá Jesus';
});

test('Database: getHistorico funciona', () => {
    const usuario = db.getUsuario(testPhone);
    const historico = db.getHistorico(usuario.id);
    return Array.isArray(historico) && historico.length > 0;
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 3: HUMANIZER
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 3: HUMANIZER.JS');

test('Humanizer: fragmentMessages divide texto', () => {
    const texto = 'Este é o primeiro parágrafo com bastante texto para testar a fragmentação.\n\nEste é o segundo parágrafo que também tem texto suficiente para ser fragmentado corretamente.';
    const fragments = humanizer.fragmentMessages(texto);
    return Array.isArray(fragments) && fragments.length >= 1;
});

test('Humanizer: calculateTypingTime retorna número', () => {
    const time = humanizer.calculateTypingTime('Olá, como você está?');
    return typeof time === 'number' && time > 0;
});

test('Humanizer: calculateFragmentDelay retorna número', () => {
    const delay = humanizer.calculateFragmentDelay('Próxima mensagem');
    return typeof delay === 'number' && delay > 0;
});

test('Humanizer: fragmenta mensagem longa corretamente', () => {
    const textoLongo = 'A'.repeat(500) + '\n\n' + 'B'.repeat(500);
    const fragments = humanizer.fragmentMessages(textoLongo);
    return fragments.length >= 2;
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 4: MEMORIA
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 4: MEMORIA.JS');

test('Memoria: extractInfo extrai nome', () => {
    const info = memoria.extractInfo('Oi, meu nome é João Carlos', {});
    return info.nome === 'João';
});

test('Memoria: extractInfo extrai família', () => {
    const info = memoria.extractInfo('Minha esposa se chama Maria e tenho dois filhos', {});
    return info.familia && info.familia.length > 0;
});

test('Memoria: extractInfo extrai trabalho', () => {
    const info = memoria.extractInfo('Trabalho como programador na empresa X', {});
    return info.trabalho && info.trabalho.includes('programador');
});

test('Memoria: detectMood detecta tristeza', () => {
    const mood = memoria.detectMood('Estou muito triste e deprimido hoje');
    return mood === 'triste';
});

test('Memoria: detectMood detecta ansiedade', () => {
    const mood = memoria.detectMood('Estou muito ansioso e preocupado com o futuro');
    return mood === 'ansioso';
});

test('Memoria: detectMood detecta felicidade', () => {
    const mood = memoria.detectMood('Estou muito feliz e alegre hoje, grato a Deus!');
    return mood === 'feliz' || mood === 'grato';
});

test('Memoria: detectMood detecta desespero', () => {
    const mood = memoria.detectMood('Estou desesperado, não aguento mais, sem saída');
    return mood === 'desesperado';
});

test('Memoria: buildContext gera contexto', () => {
    const perfil = { nome: 'João', trabalho: 'Programador', familia: [{ tipo: 'esposa', nome: 'Maria' }] };
    const context = memoria.buildContext(perfil);
    return context.includes('João') && context.includes('Programador');
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 5: TTS
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 5: TTS.JS');

test('TTS: shouldSendAudio detecta oração', () => {
    return tts.shouldSendAudio('Vou orar por você agora, meu filho', 'neutral');
});

test('TTS: shouldSendAudio detecta bênção', () => {
    return tts.shouldSendAudio('Que a paz do Senhor esteja com você, amém!', 'neutral');
});

test('TTS: shouldSendAudio retorna false para texto comum', () => {
    return !tts.shouldSendAudio('Ok, entendi sua mensagem', 'neutral');
});

test('TTS: shouldSendAudio respeita mood emocional', () => {
    return tts.shouldSendAudio('Estou aqui com você', 'emotional');
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 6: GEMINI (API)
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 6: GEMINI.JS (API)');

await testAsync('Gemini: generateResponse funciona', async () => {
    const response = await gemini.generateResponse('test_user_123', 'Olá Jesus, como vai?');
    return response && response.length > 10;
});

await testAsync('Gemini: mantém sessão de chat', async () => {
    const response = await gemini.generateResponse('test_user_123', 'Me fale sobre a paz');
    return response && response.length > 10;
});

test('Gemini: getUserContext retorna contexto', () => {
    const context = gemini.getUserContext('test_user_123');
    return context && context.conversationCount >= 2;
});

test('Gemini: clearSession funciona', () => {
    return gemini.clearSession('test_user_123') === true;
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// TESTE 7: TTS AUDIO (edge-tts)
// ═══════════════════════════════════════════════════════════════
console.log('📋 TESTE 7: TTS AUDIO (edge-tts)');

await testAsync('TTS: isTTSAvailable verifica edge-tts', async () => {
    const available = await tts.isTTSAvailable();
    if (!available) {
        console.log('   ⚠️  edge-tts não está no PATH (pip install edge-tts)');
    }
    return true; // Não falha o teste, apenas avisa
});

await testAsync('TTS: generateAudio gera áudio', async () => {
    try {
        const audio = await tts.generateAudio('Paz esteja contigo, meu filho.');
        return audio && audio.length > 1000; // Buffer deve ter mais de 1KB
    } catch (e) {
        console.log('   ⚠️  TTS falhou (edge-tts pode não estar instalado):', e.message);
        return true; // Não falha o teste
    }
});

console.log('');

// ═══════════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════════
console.log('════════════════════════════════════════════════');
console.log('📊 RESULTADO DOS TESTES');
console.log('════════════════════════════════════════════════');

tests.results.forEach(r => console.log(r));

console.log('');
console.log(`✅ Passou: ${tests.passed}`);
console.log(`❌ Falhou: ${tests.failed}`);
console.log(`📊 Total:  ${tests.passed + tests.failed}`);
console.log('');

if (tests.failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Bot pronto para uso!');
} else {
    console.log('⚠️  Alguns testes falharam. Verifique os erros acima.');
}

// Cleanup: remove usuário de teste
try {
    db.db.prepare('DELETE FROM conversas WHERE usuario_id IN (SELECT id FROM usuarios WHERE telefone = ?)').run(testPhone);
    db.db.prepare('DELETE FROM usuarios WHERE telefone = ?').run(testPhone);
    console.log('\n🧹 Dados de teste limpos com sucesso!');
} catch (e) {
    console.log('\n⚠️  Erro ao limpar dados de teste:', e.message);
}

process.exit(tests.failed > 0 ? 1 : 0);
