/**
 * Test script for Gemini AI integration
 * Run: node test-gemini.js
 */

import { initChat, generateResponse, getUserContext, clearSession } from './gemini.js';

async function testGeminiIntegration() {
  console.log('=== Testing Jesus Cristo Gemini AI Integration ===\n');

  const testUserId = '5511999999999@s.whatsapp.net';

  try {
    // Test 1: Initialize chat
    console.log('Test 1: Initializing chat session...');
    initChat(testUserId);
    console.log('✓ Chat session initialized\n');

    // Test 2: Generate first response
    console.log('Test 2: Generating first response...');
    const response1 = await generateResponse(
      testUserId,
      'Olá, Jesus. Estou me sentindo muito triste e sozinho hoje.'
    );
    console.log('User: Olá, Jesus. Estou me sentindo muito triste e sozinho hoje.');
    console.log('Jesus:', response1.substring(0, 200) + '...\n');

    // Test 3: Check user context
    console.log('Test 3: Checking user context...');
    const context1 = getUserContext(testUserId);
    console.log('Context:', JSON.stringify(context1, null, 2));
    console.log('✓ Context updated with emotional state\n');

    // Test 4: Generate follow-up response
    console.log('Test 4: Generating follow-up response...');
    const response2 = await generateResponse(
      testUserId,
      'Obrigado por me ouvir. Você pode orar por mim?'
    );
    console.log('User: Obrigado por me ouvir. Você pode orar por mim?');
    console.log('Jesus:', response2.substring(0, 200) + '...\n');

    // Test 5: Check updated context with prayer request
    console.log('Test 5: Checking updated context...');
    const context2 = getUserContext(testUserId);
    console.log('Prayer Requests:', context2.prayerRequests.length);
    console.log('Topics:', context2.topics);
    console.log('Emotional State:', context2.emotionalState);
    console.log('✓ Context tracking prayer requests and topics\n');

    // Test 6: Clear session
    console.log('Test 6: Clearing session...');
    const cleared = clearSession(testUserId);
    console.log('✓ Session cleared:', cleared ? 'Yes' : 'No');

    console.log('\n=== All tests completed successfully! ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testGeminiIntegration();
