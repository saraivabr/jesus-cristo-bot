/**
 * TTS Module Tests
 *
 * Tests for text-to-speech functionality
 */

import assert from 'assert';
import {
  generateAudio,
  generateAudioWithFallback,
  shouldSendAudio,
  getAvailableVoices,
  isTTSAvailable,
  EMOTIONAL_TRIGGERS,
  AUDIO_WORTHY_MOODS
} from '../tts.js';

/**
 * Test suite for TTS module
 */
async function runTests() {
  console.log('Starting TTS module tests...\n');

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: shouldSendAudio - emotional triggers
  try {
    console.log('Test 1: shouldSendAudio with emotional triggers');

    assert.strictEqual(
      shouldSendAudio('Estou fazendo uma oração por você', 'neutral'),
      true,
      'Should return true for prayer-related text'
    );

    assert.strictEqual(
      shouldSendAudio('Que Deus te abençoe com muita paz e amor!', 'neutral'),
      true,
      'Should return true for blessing text'
    );

    assert.strictEqual(
      shouldSendAudio('Olá, como vai?', 'neutral'),
      false,
      'Should return false for casual text'
    );

    console.log('✓ Test 1 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 2: shouldSendAudio - mood-based
  try {
    console.log('Test 2: shouldSendAudio with mood parameter');

    assert.strictEqual(
      shouldSendAudio('Qualquer texto', 'prayer'),
      true,
      'Should return true for prayer mood'
    );

    assert.strictEqual(
      shouldSendAudio('Qualquer texto', 'blessing'),
      true,
      'Should return true for blessing mood'
    );

    assert.strictEqual(
      shouldSendAudio('Qualquer texto', 'casual'),
      false,
      'Should return false for casual mood'
    );

    console.log('✓ Test 2 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 3: shouldSendAudio - invalid inputs
  try {
    console.log('Test 3: shouldSendAudio with invalid inputs');

    assert.strictEqual(
      shouldSendAudio('', 'neutral'),
      false,
      'Should return false for empty string'
    );

    assert.strictEqual(
      shouldSendAudio(null, 'neutral'),
      false,
      'Should return false for null'
    );

    assert.strictEqual(
      shouldSendAudio('x'.repeat(1000), 'neutral'),
      false,
      'Should return false for text exceeding max length'
    );

    console.log('✓ Test 3 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 4: shouldSendAudio - blessing patterns
  try {
    console.log('Test 4: shouldSendAudio with blessing patterns');

    assert.strictEqual(
      shouldSendAudio('Pai nosso que estás nos céus! Santificado seja o vosso nome!', 'neutral'),
      true,
      'Should return true for prayer with exclamations and God references'
    );

    assert.strictEqual(
      shouldSendAudio('Jesus Cristo te ama muito!!', 'neutral'),
      true,
      'Should return true for Jesus mention with exclamations'
    );

    console.log('✓ Test 4 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 5: isTTSAvailable - check if edge-tts is installed
  try {
    console.log('Test 5: isTTSAvailable');

    const isAvailable = await isTTSAvailable();
    console.log(`TTS service available: ${isAvailable}`);

    assert.strictEqual(
      typeof isAvailable,
      'boolean',
      'Should return boolean'
    );

    console.log('✓ Test 5 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 6: getAvailableVoices
  try {
    console.log('Test 6: getAvailableVoices');

    const voices = await getAvailableVoices();

    assert.ok(
      Array.isArray(voices),
      'Should return array of voices'
    );

    assert.ok(
      voices.length > 0,
      'Should return at least one voice'
    );

    console.log(`Available voices: ${voices.join(', ')}`);
    console.log('✓ Test 6 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 7: generateAudio - error handling
  try {
    console.log('Test 7: generateAudio error handling');

    // Test with invalid input
    try {
      await generateAudio('');
      assert.fail('Should throw error for empty text');
    } catch (error) {
      assert.ok(
        error.message.includes('empty'),
        'Should throw appropriate error for empty text'
      );
    }

    try {
      await generateAudio(null);
      assert.fail('Should throw error for null input');
    } catch (error) {
      assert.ok(
        error.message.includes('Invalid'),
        'Should throw appropriate error for null input'
      );
    }

    console.log('✓ Test 7 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 8: generateAudioWithFallback
  try {
    console.log('Test 8: generateAudioWithFallback');

    const result = await generateAudioWithFallback('Teste rápido');

    assert.ok(
      result.hasOwnProperty('audio'),
      'Should return object with audio property'
    );

    assert.ok(
      result.hasOwnProperty('shouldFallbackToText'),
      'Should return object with shouldFallbackToText property'
    );

    assert.strictEqual(
      typeof result.shouldFallbackToText,
      'boolean',
      'shouldFallbackToText should be boolean'
    );

    // If TTS is available, audio should be Buffer, otherwise null
    if (result.audio !== null) {
      assert.ok(
        Buffer.isBuffer(result.audio),
        'Audio should be Buffer when generated'
      );
      console.log('Audio generated successfully');
    } else {
      console.log('Audio generation skipped (TTS not available)');
    }

    console.log('✓ Test 8 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 9: Constants validation
  try {
    console.log('Test 9: Constants validation');

    assert.ok(
      Array.isArray(EMOTIONAL_TRIGGERS),
      'EMOTIONAL_TRIGGERS should be array'
    );

    assert.ok(
      EMOTIONAL_TRIGGERS.length > 0,
      'EMOTIONAL_TRIGGERS should not be empty'
    );

    assert.ok(
      Array.isArray(AUDIO_WORTHY_MOODS),
      'AUDIO_WORTHY_MOODS should be array'
    );

    assert.ok(
      AUDIO_WORTHY_MOODS.length > 0,
      'AUDIO_WORTHY_MOODS should not be empty'
    );

    console.log(`Emotional triggers: ${EMOTIONAL_TRIGGERS.length} keywords`);
    console.log(`Audio-worthy moods: ${AUDIO_WORTHY_MOODS.join(', ')}`);
    console.log('✓ Test 9 passed\n');
    passedTests++;
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message, '\n');
    failedTests++;
  }

  // Test 10: Integration test - Full workflow (only if TTS available)
  try {
    console.log('Test 10: Full workflow integration test');

    const isAvailable = await isTTSAvailable();

    if (isAvailable) {
      const testText = 'Que a paz de Cristo esteja com você';
      const shouldSend = shouldSendAudio(testText, 'blessing');

      assert.strictEqual(
        shouldSend,
        true,
        'Should determine audio should be sent for blessing'
      );

      const { audio, shouldFallbackToText } = await generateAudioWithFallback(testText, 'blessing');

      if (audio !== null) {
        assert.ok(
          Buffer.isBuffer(audio),
          'Should generate audio buffer'
        );

        assert.ok(
          audio.length > 0,
          'Audio buffer should not be empty'
        );

        console.log(`Generated audio: ${audio.length} bytes`);
      }

      console.log('✓ Test 10 passed (TTS available)\n');
    } else {
      console.log('⊘ Test 10 skipped (TTS not available)\n');
    }

    passedTests++;
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message, '\n');
    failedTests++;
  }

  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary:');
  console.log(`Total tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { runTests };
