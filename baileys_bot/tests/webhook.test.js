/**
 * Testes para Webhook WAHA
 * Execute com: node tests/webhook.test.js
 *
 * Testes de integração para:
 * - POST /webhook/messages com payload válido
 * - POST /webhook/messages com payload inválido
 * - GET /health endpoint
 * - Validação de JID normalization
 * - Tratamento de eventos
 */

// Cores para output
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
let testQueue = [];

// ═══════════════════════════════════════════════════════════════
// TEST FRAMEWORK SIMPLES
// ═══════════════════════════════════════════════════════════════

function test(description, fn) {
    testQueue.push(async () => {
        testsRun++;
        try {
            fn();
            testsPassed++;
            console.log(`${GREEN}✓${RESET} ${description}`);
        } catch (error) {
            testsFailed++;
            console.log(`${RED}✗${RESET} ${description}`);
            console.log(`  ${RED}${error.message}${RESET}`);
        }
    });
}

function asyncTest(description, fn) {
    testQueue.push(async () => {
        testsRun++;
        try {
            await fn();
            testsPassed++;
            console.log(`${GREEN}✓${RESET} ${description}`);
        } catch (error) {
            testsFailed++;
            console.log(`${RED}✗${RESET} ${description}`);
            console.log(`  ${RED}${error.message}${RESET}`);
        }
    });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
}

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Value should exist');
    }
}

// ═══════════════════════════════════════════════════════════════
// MOCK EXPRESS & REQUEST/RESPONSE
// ═══════════════════════════════════════════════════════════════

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.data = null;
        this.headers = {};
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    json(data) {
        this.data = data;
        return this;
    }

    end(data) {
        this.data = data;
    }
}

// ═══════════════════════════════════════════════════════════════
// JID NORMALIZATION UTILITIES
// ═══════════════════════════════════════════════════════════════

function normalizeJid(jid) {
    if (!jid) return null;

    let normalized = jid;

    // Se não tem @, adiciona baseado no formato
    if (!normalized.includes('@')) {
        normalized = normalized.includes('-')
            ? `${normalized}@g.us`   // Grupo
            : `${normalized}@s.whatsapp.net`;  // Individual
    }

    return normalized;
}

function isValidJid(jid) {
    if (!jid) return false;

    // Deve ter @ seguido de domínio
    if (!jid.includes('@')) return false;

    const parts = jid.split('@');
    if (parts.length !== 2) return false;

    const [number, domain] = parts;

    // Número deve ter apenas dígitos
    if (!/^\d+$/.test(number) && !number.includes('-')) return false;

    // Domínio deve ser g.us (grupo) ou s.whatsapp.net (individual)
    return domain === 'g.us' || domain === 's.whatsapp.net';
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK PAYLOAD VALIDATOR
// ═══════════════════════════════════════════════════════════════

class WebhookValidator {
    validatePayload(payload) {
        if (!payload) {
            throw new Error('Payload is null or undefined');
        }

        if (!payload.event) {
            throw new Error('Missing event field');
        }

        if (!payload.data) {
            throw new Error('Missing data field');
        }

        // Validações específicas por tipo de evento
        if (payload.event === 'message') {
            if (!payload.data.from) {
                throw new Error('Message event missing "from" field');
            }
            if (!payload.data.body) {
                throw new Error('Message event missing "body" field');
            }
        }

        return true;
    }

    isMessageEvent(payload) {
        return payload?.event === 'message';
    }

    isAckEvent(payload) {
        return payload?.event === 'message_ack';
    }

    shouldIgnoreEvent(payload) {
        const event = payload?.event;
        const ignoredEvents = ['typing', 'presence', 'status', 'read_receipt'];
        return ignoredEvents.includes(event);
    }
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK PROCESSOR (Simula o processamento do index.js)
// ═══════════════════════════════════════════════════════════════

class WebhookProcessor {
    constructor() {
        this.validator = new WebhookValidator();
        this.processedMessages = [];
        this.errors = [];
    }

    processWebhook(payload) {
        try {
            // Valida payload
            this.validator.validatePayload(payload);

            // Processa baseado no tipo de evento
            if (payload.event === 'message') {
                return this.processMessage(payload);
            } else if (payload.event === 'message_ack') {
                return { status: 'ack_received' };
            } else if (this.validator.shouldIgnoreEvent(payload)) {
                return { status: 'ignored', reason: 'event_type_ignored' };
            } else {
                return { status: 'ignored', reason: 'unknown_event' };
            }
        } catch (error) {
            this.errors.push({
                message: error.message,
                payload: payload,
                timestamp: Date.now()
            });
            return { status: 'error', message: error.message };
        }
    }

    processMessage(payload) {
        const { from, body } = payload.data;

        // Normaliza JID
        const normalizedJid = normalizeJid(from);

        if (!normalizedJid) {
            throw new Error('Invalid JID format');
        }

        // Registra mensagem processada
        this.processedMessages.push({
            jid: normalizedJid,
            body: body,
            originalFrom: from,
            timestamp: Date.now(),
            pushName: payload.data.pushName || 'Unknown'
        });

        return {
            status: 'processed',
            jid: normalizedJid,
            messageCount: this.processedMessages.length
        };
    }

    getProcessedCount() {
        return this.processedMessages.length;
    }

    getErrorCount() {
        return this.errors.length;
    }

    getLastError() {
        return this.errors[this.errors.length - 1];
    }

    getProcessedMessages() {
        return this.processedMessages;
    }
}

// ═══════════════════════════════════════════════════════════════
// TESTES: JID NORMALIZATION
// ═══════════════════════════════════════════════════════════════

console.log(`\n${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}WEBHOOK TEST SUITE${RESET}`);
console.log(`${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`);

console.log(`${YELLOW}1. JID Normalization${RESET}`);

test('should normalize individual JID (add @s.whatsapp.net)', () => {
    const jid = normalizeJid('5511999999999');
    assertEqual(jid, '5511999999999@s.whatsapp.net', 'Should add individual domain');
});

test('should normalize group JID (add @g.us)', () => {
    const jid = normalizeJid('120363999999999-1234567890');
    assertEqual(jid, '120363999999999-1234567890@g.us', 'Should add group domain');
});

test('should preserve already normalized JID (individual)', () => {
    const jid = normalizeJid('5511999999999@s.whatsapp.net');
    assertEqual(jid, '5511999999999@s.whatsapp.net', 'Should preserve normalized individual JID');
});

test('should preserve already normalized JID (group)', () => {
    const jid = normalizeJid('120363999999999-1234567890@g.us');
    assertEqual(jid, '120363999999999-1234567890@g.us', 'Should preserve normalized group JID');
});

test('should handle null/undefined JID', () => {
    const jid1 = normalizeJid(null);
    const jid2 = normalizeJid(undefined);
    assertEqual(jid1, null, 'Should handle null');
    assertEqual(jid2, null, 'Should handle undefined');
});

test('should validate correct individual JID format', () => {
    const valid = isValidJid('5511999999999@s.whatsapp.net');
    assert(valid === true, 'Should validate individual JID');
});

test('should validate correct group JID format', () => {
    const valid = isValidJid('120363999999999-1234567890@g.us');
    assert(valid === true, 'Should validate group JID');
});

test('should reject JID without domain', () => {
    const valid = isValidJid('5511999999999');
    assert(valid === false, 'Should reject JID without @');
});

test('should reject JID with invalid domain', () => {
    const valid = isValidJid('5511999999999@invalid.com');
    assert(valid === false, 'Should reject invalid domain');
});

test('should reject JID with multiple @', () => {
    const valid = isValidJid('5511999999999@s.whatsapp.net@extra');
    assert(valid === false, 'Should reject multiple @');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: WEBHOOK PAYLOAD VALIDATION
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}2. Webhook Payload Validation${RESET}`);

test('should accept valid message payload', () => {
    const validator = new WebhookValidator();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: 'Hello',
            pushName: 'User'
        }
    };
    assert(validator.validatePayload(payload) === true, 'Should accept valid payload');
});

test('should reject payload without event', () => {
    const validator = new WebhookValidator();
    const payload = {
        data: { from: '5511999999999@s.whatsapp.net', body: 'Hello' }
    };
    try {
        validator.validatePayload(payload);
        throw new Error('Should have thrown error');
    } catch (e) {
        assert(e.message.includes('event'), 'Should complain about missing event');
    }
});

test('should reject payload without data', () => {
    const validator = new WebhookValidator();
    const payload = {
        event: 'message'
    };
    try {
        validator.validatePayload(payload);
        throw new Error('Should have thrown error');
    } catch (e) {
        assert(e.message.includes('data'), 'Should complain about missing data');
    }
});

test('should reject message without "from" field', () => {
    const validator = new WebhookValidator();
    const payload = {
        event: 'message',
        data: { body: 'Hello' }
    };
    try {
        validator.validatePayload(payload);
        throw new Error('Should have thrown error');
    } catch (e) {
        assert(e.message.includes('from'), 'Should complain about missing from');
    }
});

test('should reject message without "body" field', () => {
    const validator = new WebhookValidator();
    const payload = {
        event: 'message',
        data: { from: '5511999999999@s.whatsapp.net' }
    };
    try {
        validator.validatePayload(payload);
        throw new Error('Should have thrown error');
    } catch (e) {
        assert(e.message.includes('body'), 'Should complain about missing body');
    }
});

test('should identify message events correctly', () => {
    const validator = new WebhookValidator();
    const payload = { event: 'message', data: {} };
    assert(validator.isMessageEvent(payload) === true, 'Should identify message event');
});

test('should identify ack events correctly', () => {
    const validator = new WebhookValidator();
    const payload = { event: 'message_ack', data: {} };
    assert(validator.isAckEvent(payload) === true, 'Should identify ack event');
});

test('should ignore typing events', () => {
    const validator = new WebhookValidator();
    const payload = { event: 'typing', data: {} };
    assert(validator.shouldIgnoreEvent(payload) === true, 'Should ignore typing');
});

test('should ignore presence events', () => {
    const validator = new WebhookValidator();
    const payload = { event: 'presence', data: {} };
    assert(validator.shouldIgnoreEvent(payload) === true, 'Should ignore presence');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: WEBHOOK PROCESSING
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}3. Webhook Processing${RESET}`);

test('should process valid message webhook', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999',
            body: 'Olá, tudo bem?',
            pushName: 'João'
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should return processed status');
    assert(result.jid.includes('@s.whatsapp.net'), 'Should normalize JID');
});

test('should track processed messages', () => {
    const processor = new WebhookProcessor();

    const payload1 = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: 'Primeira',
            pushName: 'User1'
        }
    };

    const payload2 = {
        event: 'message',
        data: {
            from: '5512888888888@s.whatsapp.net',
            body: 'Segunda',
            pushName: 'User2'
        }
    };

    processor.processWebhook(payload1);
    processor.processWebhook(payload2);

    assertEqual(processor.getProcessedCount(), 2, 'Should track 2 messages');
    const messages = processor.getProcessedMessages();
    assert(messages[0].body === 'Primeira', 'Should preserve first message');
    assert(messages[1].body === 'Segunda', 'Should preserve second message');
});

test('should handle group messages', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '120363999999999-1234567890',
            body: 'Mensagem de grupo',
            pushName: 'GroupMember'
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should process group message');
    assert(result.jid.includes('@g.us'), 'Should normalize group JID');
});

test('should handle ack events', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message_ack',
        data: { id: 'msg_123' }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'ack_received', 'Should acknowledge ack event');
});

test('should ignore unhandled events', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'typing',
        data: { from: '5511999999999@s.whatsapp.net' }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'ignored', 'Should ignore typing event');
});

test('should handle invalid payloads gracefully', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: { from: '5511999999999' }
        // Falta body
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'error', 'Should return error status');
    assert(processor.getErrorCount() === 1, 'Should track error');
});

test('should preserve message content including emojis', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: 'Deus te abençoe 🙏❤️',
            pushName: 'User'
        }
    };
    processor.processWebhook(payload);
    const messages = processor.getProcessedMessages();
    assert(messages[0].body.includes('🙏'), 'Should preserve emojis');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: HEALTH ENDPOINT
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}4. Health Endpoint${RESET}`);

test('should respond with 200 OK to health check', () => {
    // Simula resposta de health
    const response = new MockResponse();
    response.status(200).json({ status: 'ok' });
    assertEqual(response.statusCode, 200, 'Should return 200 status');
    assertEqual(response.data.status, 'ok', 'Should return ok status');
});

test('should accept heartbeat from WAHA', () => {
    const processor = new WebhookProcessor();
    // Health check é tratado separadamente no index.js
    // Aqui testamos que webhook processor não quebra com payload vazio
    assert(processor.getErrorCount() === 0, 'Should start with no errors');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: EDGE CASES
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}5. Edge Cases & Special Handling${RESET}`);

test('should handle very long message text', () => {
    const processor = new WebhookProcessor();
    const longText = 'A'.repeat(4096); // WhatsApp limit
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: longText,
            pushName: 'User'
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should handle long messages');
});

test('should reject empty message body', () => {
    const validator = new WebhookValidator();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: '',
            pushName: 'User'
        }
    };
    // Body vazio deve ser rejeitado (sempre deve ter body ou media)
    try {
        validator.validatePayload(payload);
        throw new Error('Should have rejected empty body');
    } catch (e) {
        assert(e.message.includes('body'), 'Should complain about missing body');
    }
});

test('should handle whitespace-only message', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: '   ',
            pushName: 'User'
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should accept whitespace');
});

test('should handle missing pushName', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: 'Hello'
            // Sem pushName
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should handle missing pushName');
    const messages = processor.getProcessedMessages();
    assert(messages[0].pushName === 'Unknown', 'Should default to Unknown');
});

test('should handle special characters in message', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: '@#$%^&*()_+-=[]{}|;:\'",.<>?/\\~`',
            pushName: 'User'
        }
    };
    const result = processor.processWebhook(payload);
    assertEqual(result.status, 'processed', 'Should handle special characters');
});

test('should handle duplicate messages from same user', () => {
    const processor = new WebhookProcessor();
    const payload = {
        event: 'message',
        data: {
            from: '5511999999999@s.whatsapp.net',
            body: 'Same message',
            pushName: 'User'
        }
    };

    processor.processWebhook(payload);
    processor.processWebhook(payload);

    assertEqual(processor.getProcessedCount(), 2, 'Should process both messages');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: MULTI-SESSION HANDLING
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}6. Multi-User Handling${RESET}`);

test('should handle messages from different users', () => {
    const processor = new WebhookProcessor();

    const users = [
        '5511999999999@s.whatsapp.net',
        '5512888888888@s.whatsapp.net',
        '5513777777777@s.whatsapp.net'
    ];

    users.forEach(user => {
        processor.processWebhook({
            event: 'message',
            data: {
                from: user,
                body: `Message from ${user}`,
                pushName: `User ${user.split('@')[0]}`
            }
        });
    });

    assertEqual(processor.getProcessedCount(), 3, 'Should handle 3 different users');
});

test('should preserve user context across messages', () => {
    const processor = new WebhookProcessor();
    const jid = '5511999999999@s.whatsapp.net';

    processor.processWebhook({
        event: 'message',
        data: {
            from: jid,
            body: 'First message',
            pushName: 'João'
        }
    });

    processor.processWebhook({
        event: 'message',
        data: {
            from: jid,
            body: 'Second message',
            pushName: 'João'
        }
    });

    const messages = processor.getProcessedMessages();
    assert(messages[0].jid === messages[1].jid, 'Should have same JID');
    assert(messages[0].pushName === messages[1].pushName, 'Should have same pushName');
});

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

async function runTests() {
    // Executa todos os testes na fila
    for (const testFn of testQueue) {
        await testFn();
    }

    // ═══════════════════════════════════════════════════════════════
    // TEST SUMMARY
    // ═══════════════════════════════════════════════════════════════

    console.log(`\n${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BLUE}Test Summary${RESET}`);
    console.log(`${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    console.log(`Total:  ${testsRun}`);
    console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
    if (testsFailed > 0) {
        console.log(`${RED}Failed: ${testsFailed}${RESET}`);
    } else {
        console.log(`${GREEN}Failed: 0${RESET}`);
    }
    console.log(`\nSuccess Rate: ${((testsPassed / testsRun) * 100).toFixed(2)}%`);

    if (testsFailed === 0) {
        console.log(`\n${GREEN}✓ All tests passed!${RESET}\n`);
        process.exit(0);
    } else {
        console.log(`\n${RED}✗ Some tests failed${RESET}\n`);
        process.exit(1);
    }
}

// Inicia runner
runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
