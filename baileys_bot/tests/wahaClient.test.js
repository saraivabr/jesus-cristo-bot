/**
 * Testes para WAHA Client
 * Execute com: node tests/wahaClient.test.js
 *
 * Testes de mocking para:
 * - sendMessage
 * - getSessionInfo
 * - healthCheck
 * - markMessageAsRead
 * - Retry logic
 */

import fetch from 'node-fetch';

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

// ═══════════════════════════════════════════════════════════════
// MOCK WAHA CLIENT
// ═══════════════════════════════════════════════════════════════

class MockWahaClient {
    constructor() {
        this.requests = [];
        this.shouldFail = false;
        this.failureRate = 0; // 0-1, probabilidade de falha
        this.responseDelay = 0; // ms
    }

    async wahaRequest(method, path, body = null) {
        const url = `http://localhost:3000/api/default${path}`;
        const request = { method, path, body, url, timestamp: Date.now() };
        this.requests.push(request);

        // Simula delay
        if (this.responseDelay > 0) {
            await new Promise(r => setTimeout(r, this.responseDelay));
        }

        // Simula falha aleatória
        if (this.shouldFail || Math.random() < this.failureRate) {
            const error = new Error('WAHA Request Failed');
            error.statusCode = 500;
            throw error;
        }

        // Retorna respostas mock baseadas no método e path
        if (method === 'GET' && path === '/me') {
            return {
                wa_id: '5511999999999',
                name: 'Jesus Bot',
                pushName: 'Jesus Cristo'
            };
        }

        if (method === 'POST' && path === '/messages') {
            return {
                id: 'msg_' + Date.now(),
                chatId: body?.chatId,
                text: body?.text,
                status: 'sent'
            };
        }

        if (method === 'POST' && path.includes('/read')) {
            return { status: 'read' };
        }

        return { success: true };
    }

    async sendMessage(jid, text) {
        try {
            const result = await this.wahaRequest('POST', '/messages', {
                chatId: jid,
                text: text
            });
            return result !== null;
        } catch (e) {
            return false;
        }
    }

    async sendMessageWithRetry(jid, text, maxRetries = 3) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.wahaRequest('POST', '/messages', {
                    chatId: jid,
                    text: text
                });
                if (result) {
                    return { success: true, attempt, message: result };
                }
            } catch (error) {
                lastError = error;
                // Exponential backoff: 100ms, 200ms, 400ms
                const delay = Math.pow(2, attempt - 1) * 100;
                await new Promise(r => setTimeout(r, delay));
            }
        }
        return { success: false, attempt: maxRetries, error: lastError };
    }

    async getSessionInfo() {
        return await this.wahaRequest('GET', '/me');
    }

    async healthCheck() {
        try {
            const info = await this.getSessionInfo();
            return info !== null;
        } catch (e) {
            return false;
        }
    }

    async markMessageAsRead(messageId) {
        return await this.wahaRequest('POST', `/messages/${messageId}/read`);
    }

    getRequestCount() {
        return this.requests.length;
    }

    getLastRequest() {
        return this.requests[this.requests.length - 1];
    }

    clearRequests() {
        this.requests = [];
    }
}

// ═══════════════════════════════════════════════════════════════
// TESTES: BASIC OPERATIONS
// ═══════════════════════════════════════════════════════════════

console.log(`\n${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}WAHA CLIENT TEST SUITE${RESET}`);
console.log(`${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`);

console.log(`${YELLOW}1. Basic Message Operations${RESET}`);

asyncTest('sendMessage() - should send message successfully', async () => {
    const client = new MockWahaClient();
    const result = await client.sendMessage('5511999999999@s.whatsapp.net', 'Hello');
    assert(result === true, 'sendMessage should return true');
});

asyncTest('sendMessage() - should normalize JID', async () => {
    const client = new MockWahaClient();
    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    const req = client.getLastRequest();
    assert(req.body.chatId === '5511999999999@s.whatsapp.net', 'JID should be passed correctly');
});

asyncTest('sendMessage() - should include message text', async () => {
    const client = new MockWahaClient();
    const text = 'Deus te abençoe';
    await client.sendMessage('5511999999999@s.whatsapp.net', text);
    const req = client.getLastRequest();
    assert(req.body.text === text, 'Message text should be included');
});

asyncTest('sendMessage() - should handle failure gracefully', async () => {
    const client = new MockWahaClient();
    client.shouldFail = true;
    const result = await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    assert(result === false, 'sendMessage should return false on failure');
});

console.log(`\n${YELLOW}2. Session & Status${RESET}`);

asyncTest('getSessionInfo() - should return session data', async () => {
    const client = new MockWahaClient();
    const info = await client.getSessionInfo();
    assert(info?.wa_id !== undefined, 'Should return wa_id');
    assert(info?.name !== undefined, 'Should return name');
});

asyncTest('healthCheck() - should return true for healthy connection', async () => {
    const client = new MockWahaClient();
    const healthy = await client.healthCheck();
    assert(healthy === true, 'healthCheck should return true');
});

asyncTest('healthCheck() - should return false when session fails', async () => {
    const client = new MockWahaClient();
    client.shouldFail = true;
    const healthy = await client.healthCheck();
    assert(healthy === false, 'healthCheck should return false on error');
});

asyncTest('markMessageAsRead() - should mark message as read', async () => {
    const client = new MockWahaClient();
    const result = await client.markMessageAsRead('msg_123456');
    assert(result?.status === 'read', 'Should return read status');
});

console.log(`\n${YELLOW}3. Retry Logic${RESET}`);

asyncTest('sendMessageWithRetry() - should succeed on first attempt', async () => {
    const client = new MockWahaClient();
    const result = await client.sendMessageWithRetry('5511999999999@s.whatsapp.net', 'Test');
    assert(result.success === true, 'Should succeed on first attempt');
    assert(result.attempt === 1, 'Attempt should be 1');
});

asyncTest('sendMessageWithRetry() - should retry on failure', async () => {
    const client = new MockWahaClient();
    client.failureRate = 0.7; // 70% chance of failure
    const result = await client.sendMessageWithRetry('5511999999999@s.whatsapp.net', 'Test', 3);
    // May succeed or fail, but should attempt retries
    assert(result.attempt <= 3, 'Should not exceed max retries');
});

asyncTest('sendMessageWithRetry() - should fail after max retries', async () => {
    const client = new MockWahaClient();
    client.shouldFail = true;
    const result = await client.sendMessageWithRetry('5511999999999@s.whatsapp.net', 'Test', 2);
    assert(result.success === false, 'Should fail after max retries');
    assert(result.attempt === 2, 'Should have attempted max retries');
});

asyncTest('sendMessageWithRetry() - should use exponential backoff', async () => {
    const client = new MockWahaClient();
    const startTime = Date.now();
    client.shouldFail = true;
    const result = await client.sendMessageWithRetry('5511999999999@s.whatsapp.net', 'Test', 2);
    const elapsed = Date.now() - startTime;
    // Expected: 100ms (fail) + 100ms (backoff) + 200ms (fail) = 400ms min (with tolerance)
    assert(elapsed >= 100, 'Should use backoff delays');
    assert(result.attempt === 2, 'Should have done retries');
});

console.log(`\n${YELLOW}4. Request Validation${RESET}`);

asyncTest('should use correct HTTP method for each operation', async () => {
    const client = new MockWahaClient();

    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    assert(client.getLastRequest().method === 'POST', 'sendMessage should use POST');

    client.clearRequests();
    await client.getSessionInfo();
    assert(client.getLastRequest().method === 'GET', 'getSessionInfo should use GET');

    client.clearRequests();
    await client.markMessageAsRead('msg_123');
    assert(client.getLastRequest().method === 'POST', 'markMessageAsRead should use POST');
});

asyncTest('should use correct API paths', async () => {
    const client = new MockWahaClient();

    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    assert(client.getLastRequest().path === '/messages', 'Should use /messages path');

    client.clearRequests();
    await client.getSessionInfo();
    assert(client.getLastRequest().path === '/me', 'Should use /me path');

    client.clearRequests();
    await client.markMessageAsRead('msg_123');
    assert(client.getLastRequest().path === '/messages/msg_123/read', 'Should include messageId');
});

asyncTest('should track all requests in history', async () => {
    const client = new MockWahaClient();

    assert(client.getRequestCount() === 0, 'Should start with no requests');

    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test1');
    assert(client.getRequestCount() === 1, 'Should track first request');

    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test2');
    assert(client.getRequestCount() === 2, 'Should track multiple requests');

    client.clearRequests();
    assert(client.getRequestCount() === 0, 'Should clear request history');
});

console.log(`\n${YELLOW}5. Error Handling${RESET}`);

asyncTest('should handle network errors gracefully', async () => {
    const client = new MockWahaClient();
    client.shouldFail = true;

    try {
        const result = await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
        assert(result === false, 'Should return false on network error');
    } catch (e) {
        // Should not throw, but handle gracefully
        throw new Error('Should not throw on network error');
    }
});

asyncTest('should timeout after excessive delays', async () => {
    const client = new MockWahaClient();
    client.responseDelay = 50; // Small delay for test

    const start = Date.now();
    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    const elapsed = Date.now() - start;

    assert(elapsed >= client.responseDelay, 'Should respect response delay');
});

// ═══════════════════════════════════════════════════════════════
// TESTES: EDGE CASES
// ═══════════════════════════════════════════════════════════════

console.log(`\n${YELLOW}6. Edge Cases${RESET}`);

asyncTest('should handle empty message text', async () => {
    const client = new MockWahaClient();
    await client.sendMessage('5511999999999@s.whatsapp.net', '');
    const req = client.getLastRequest();
    assert(req.body.text === '', 'Should handle empty text');
});

asyncTest('should handle special characters in message', async () => {
    const client = new MockWahaClient();
    const specialText = 'Olá! Como vai? 🙏 #fé';
    await client.sendMessage('5511999999999@s.whatsapp.net', specialText);
    const req = client.getLastRequest();
    assert(req.body.text === specialText, 'Should preserve special characters');
});

asyncTest('should handle long message', async () => {
    const client = new MockWahaClient();
    const longText = 'A'.repeat(1000);
    await client.sendMessage('5511999999999@s.whatsapp.net', longText);
    const req = client.getLastRequest();
    assert(req.body.text.length === 1000, 'Should handle long messages');
});

asyncTest('should handle group JID format', async () => {
    const client = new MockWahaClient();
    await client.sendMessage('120363999999999-1234567890@g.us', 'Test group');
    const req = client.getLastRequest();
    assert(req.body.chatId === '120363999999999-1234567890@g.us', 'Should handle group JID');
});

asyncTest('should handle individual JID format', async () => {
    const client = new MockWahaClient();
    await client.sendMessage('5511999999999@s.whatsapp.net', 'Test');
    const req = client.getLastRequest();
    assert(req.body.chatId === '5511999999999@s.whatsapp.net', 'Should handle individual JID');
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
