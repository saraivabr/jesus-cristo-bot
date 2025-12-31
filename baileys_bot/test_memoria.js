/**
 * Testes básicos para validar o sistema de memória
 */

import {
    extractInfo,
    buildContext,
    detectMood,
    shouldFollowUp,
    suggestFollowUpTime,
    analyzeContactFrequency,
    registrarHorarioContato
} from './memoria.js';

console.log('=== TESTANDO SISTEMA DE MEMÓRIA ===\n');

// ═══════════════════════════════════════════════════════════════
// Teste 1: Extração de Informações
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 1: extractInfo ---');
const mensagem1 = 'Olá, meu nome é João e trabalho como professor. Minha esposa se chama Maria e estou muito triste.';
const info1 = extractInfo(mensagem1);
console.log('Mensagem:', mensagem1);
console.log('Info extraída:', JSON.stringify(info1, null, 2));
console.log('✓ Nome extraído:', info1.nome === 'João' ? 'PASS' : 'FAIL');
console.log('✓ Trabalho extraído:', info1.trabalho === 'professor' ? 'PASS' : 'FAIL');
console.log('✓ Família extraída:', info1.familia.some(f => f.nome === 'Maria') ? 'PASS' : 'FAIL');
console.log('✓ Sentimento extraído:', info1.sentimentos.includes('tristeza') ? 'PASS' : 'FAIL');
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 2: Construção de Contexto
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 2: buildContext ---');
const perfil = {
    nome: 'João',
    trabalho: 'professor',
    familia: [{ tipo: 'esposa', nome: 'Maria' }],
    localizacao: 'São Paulo',
    sentimentos: ['tristeza', 'ansiedade'],
    hobbies: ['leitura', 'música']
};
const contexto = buildContext(perfil);
console.log('Contexto gerado:');
console.log(contexto);
console.log('✓ Contém nome:', contexto.includes('João') ? 'PASS' : 'FAIL');
console.log('✓ Contém trabalho:', contexto.includes('professor') ? 'PASS' : 'FAIL');
console.log('✓ Contém família:', contexto.includes('Maria') ? 'PASS' : 'FAIL');
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 3: Detecção de Humor
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 3: detectMood ---');
const testeCases = [
    { msg: 'Estou muito triste e sozinho', expected: 'triste' },
    { msg: 'Não aguento mais!!! Estou desesperado!!!', expected: 'desesperado' },
    { msg: 'Que dia maravilhoso! Estou muito feliz!', expected: 'feliz' },
    { msg: 'Estou muito ansioso com o trabalho', expected: 'ansioso' },
    { msg: 'Obrigado por tudo, estou muito grato', expected: 'grato' },
    { msg: 'Bom dia', expected: 'neutro' }
];

testeCases.forEach(({ msg, expected }) => {
    const mood = detectMood(msg);
    const status = mood === expected ? 'PASS' : 'FAIL';
    console.log(`✓ "${msg}" -> ${mood} (esperado: ${expected}) [${status}]`);
});
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 4: Sistema de Follow-up
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 4: shouldFollowUp ---');
const perfilCritico = {
    sentimentos: ['desespero'],
    ultimoContato: null
};
const respostaOracao = 'Orarei por você, filho.';
const deveFollowUp = shouldFollowUp(perfilCritico, respostaOracao);
console.log('✓ Deve fazer follow-up (perfil crítico + oração):', deveFollowUp ? 'PASS' : 'FAIL');

const perfilNormal = {
    sentimentos: ['feliz'],
    ultimoContato: Date.now()
};
const respostaNormal = 'Que bom!';
const naoDeveFollowUp = !shouldFollowUp(perfilNormal, respostaNormal);
console.log('✓ Não deve fazer follow-up (perfil normal):', naoDeveFollowUp ? 'PASS' : 'FAIL');
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 5: Análise de Frequência
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 5: analyzeContactFrequency ---');
const agora = Date.now();
const umDia = 24 * 60 * 60 * 1000;

const historicoDiario = [agora - (umDia * 3), agora - (umDia * 2), agora - umDia, agora];
const freqDiaria = analyzeContactFrequency(historicoDiario);
console.log('✓ Frequência diária:', freqDiaria === 'diária' ? 'PASS' : 'FAIL', `(${freqDiaria})`);

const historicoSemanal = [agora - (umDia * 14), agora - (umDia * 7), agora];
const freqSemanal = analyzeContactFrequency(historicoSemanal);
console.log('✓ Frequência semanal:', freqSemanal === 'semanal' ? 'PASS' : 'FAIL', `(${freqSemanal})`);

const historicoMensal = [agora - (umDia * 60), agora - (umDia * 30), agora];
const freqMensal = analyzeContactFrequency(historicoMensal);
console.log('✓ Frequência mensal:', freqMensal === 'mensal' ? 'PASS' : 'FAIL', `(${freqMensal})`);
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 6: Registro de Horário
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 6: registrarHorarioContato ---');
const perfilTeste = { nome: 'Teste' };
const perfilAtualizado = registrarHorarioContato(perfilTeste);
console.log('✓ Horário registrado:', perfilAtualizado.horariosContato.length > 0 ? 'PASS' : 'FAIL');
console.log('✓ Hora atual:', perfilAtualizado.horariosContato[0]);
console.log();

// ═══════════════════════════════════════════════════════════════
// Teste 7: Sugestão de Follow-up Time
// ═══════════════════════════════════════════════════════════════
console.log('--- Teste 7: suggestFollowUpTime ---');
const perfilComHistorico = {
    horariosContato: [9, 10, 9, 11, 10] // Média ~9.8, arredonda para 9h
};
const followUpTime = suggestFollowUpTime(perfilComHistorico);
console.log('✓ Follow-up agendado para:', followUpTime.toLocaleString('pt-BR'));
console.log('✓ Hora do follow-up:', followUpTime.getHours(), '(esperado ~9-10h)');
console.log();

console.log('=== TESTES CONCLUÍDOS ===');
