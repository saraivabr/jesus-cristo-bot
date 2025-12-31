/**
 * TTS (Text-to-Speech) Module
 *
 * Provides text-to-speech functionality for emotional and important messages.
 * Uses Google Cloud TTS via edge-tts for free, high-quality Brazilian Portuguese audio.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TTS_CONFIG } from './config.js';

const execAsync = promisify(exec);

// Path to edge-tts binary (pip install edge-tts)
// Using full path because Node.js child processes may not have the same PATH
const EDGE_TTS_PATH = '/opt/homebrew/bin/edge-tts';

/**
 * Emotional keywords that indicate audio should be sent
 * These represent moments when audio adds more spiritual connection
 */
const EMOTIONAL_TRIGGERS = [
  'oração',
  'ore',
  'orando',
  'orar',
  'paz',
  'amor',
  'abençoado',
  'bênção',
  'benção',
  'glória',
  'aleluia',
  'amém',
  'graça',
  'fé',
  'esperança',
  'salvação',
  'perdão',
  'perdoado',
  'milagre',
  'cura',
  'curado',
  'libertação',
  'libertado',
  'vitória',
  'vitorioso'
];

/**
 * Mood types that warrant audio responses
 */
const AUDIO_WORTHY_MOODS = [
  'prayer',
  'blessing',
  'emotional',
  'spiritual',
  'urgent',
  'important'
];

/**
 * Generate audio buffer from text using edge-tts
 *
 * @param {string} text - The text to convert to speech
 * @returns {Promise<Buffer>} Audio buffer in MP3 format
 * @throws {Error} If TTS generation fails
 */
export async function generateAudio(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input for TTS');
  }

  // Trim text to maximum length
  const trimmedText = text.slice(0, TTS_CONFIG.maxMessageLength);

  if (trimmedText.length === 0) {
    throw new Error('Text is empty after trimming');
  }

  // Create temporary file paths
  const tempId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tempTextFile = join(tmpdir(), `${tempId}.txt`);
  const tempAudioFile = join(tmpdir(), `${tempId}.mp3`);

  try {
    // Write text to temporary file (edge-tts reads from file for long texts)
    await writeFile(tempTextFile, trimmedText, 'utf-8');

    // Select voice based on configuration
    // pt-BR-FranciscaNeural is a male voice in Brazilian Portuguese
    const voice = TTS_CONFIG.voice === 'pt-BR-Wavenet-A'
      ? 'pt-BR-AntonioNeural' // Male voice (similar to Wavenet-A)
      : TTS_CONFIG.voice;

    // Construct edge-tts command
    // edge-tts --voice pt-BR-AntonioNeural --text "texto" --write-media output.mp3
    const command = [
      EDGE_TTS_PATH,
      `--voice "${voice}"`,
      `--text "${trimmedText.replace(/"/g, '\\"')}"`,
      `--write-media "${tempAudioFile}"`,
      `--rate="${TTS_CONFIG.speed > 1 ? '+' : ''}${Math.round((TTS_CONFIG.speed - 1) * 100)}%"`,
      `--pitch="${TTS_CONFIG.pitch > 0 ? '+' : ''}${TTS_CONFIG.pitch}Hz"`
    ].join(' ');

    // Execute edge-tts command
    const { stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    // Check if audio file was created
    if (!existsSync(tempAudioFile)) {
      throw new Error(`TTS failed to generate audio file: ${stderr}`);
    }

    // Read audio file as buffer
    const { readFile } = await import('fs/promises');
    const audioBuffer = await readFile(tempAudioFile);

    // Cleanup temporary files
    await cleanupTempFiles([tempTextFile, tempAudioFile]);

    return audioBuffer;

  } catch (error) {
    // Cleanup on error
    await cleanupTempFiles([tempTextFile, tempAudioFile]);

    // Enhance error message
    if (error.message.includes('edge-tts')) {
      throw new Error(
        'TTS service unavailable. Please ensure edge-tts is installed (pip install edge-tts)'
      );
    }

    throw new Error(`TTS generation failed: ${error.message}`);
  }
}

/**
 * Determine if audio should be sent based on text content and mood
 *
 * @param {string} text - The message text
 * @param {string} [mood='neutral'] - The mood/context of the message
 * @returns {boolean} True if audio should be sent
 */
export function shouldSendAudio(text, mood = 'neutral') {
  // Check if text is valid and within length limits
  if (!text || typeof text !== 'string') {
    return false;
  }

  if (text.length === 0 || text.length > TTS_CONFIG.maxMessageLength) {
    return false;
  }

  // Check if mood warrants audio
  if (AUDIO_WORTHY_MOODS.includes(mood)) {
    return true;
  }

  // Check for emotional trigger words
  const lowerText = text.toLowerCase();
  const hasEmotionalTrigger = EMOTIONAL_TRIGGERS.some(trigger =>
    lowerText.includes(trigger)
  );

  if (hasEmotionalTrigger) {
    return true;
  }

  // Check for prayer patterns (multiple exclamations, blessings)
  const hasExclamations = (text.match(/!/g) || []).length >= 2;
  const hasBlessings = /pai|senhor|deus|jesus|cristo|espírito santo/i.test(text);

  if (hasExclamations && hasBlessings) {
    return true;
  }

  return false;
}

/**
 * Cleanup temporary files
 *
 * @param {string[]} filePaths - Array of file paths to delete
 * @returns {Promise<void>}
 */
async function cleanupTempFiles(filePaths) {
  const deletePromises = filePaths.map(async (filePath) => {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Ignore cleanup errors - they're not critical
      console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
    }
  });

  await Promise.allSettled(deletePromises);
}

/**
 * Generate audio with fallback to text on failure
 *
 * @param {string} text - The text to convert
 * @param {string} [mood='neutral'] - The mood/context
 * @returns {Promise<{audio: Buffer|null, shouldFallbackToText: boolean}>}
 */
export async function generateAudioWithFallback(text, mood = 'neutral') {
  try {
    const audio = await generateAudio(text);
    return { audio, shouldFallbackToText: false };
  } catch (error) {
    console.error('TTS generation failed:', error.message);

    // Return null audio with fallback flag if configured
    if (TTS_CONFIG.fallbackToText) {
      return { audio: null, shouldFallbackToText: true };
    }

    throw error;
  }
}

/**
 * Get available voices for Brazilian Portuguese
 *
 * @returns {Promise<string[]>} List of available voices
 */
export async function getAvailableVoices() {
  try {
    const { stdout } = await execAsync(`${EDGE_TTS_PATH} --list-voices`, {
      timeout: 10000
    });

    // Parse output and filter for pt-BR voices
    const voices = stdout
      .split('\n')
      .filter(line => line.includes('pt-BR'))
      .map(line => {
        const match = line.match(/Name:\s*([^\s]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    return voices;
  } catch (error) {
    console.warn('Failed to list voices:', error.message);
    // Return default voices as fallback
    return [
      'pt-BR-AntonioNeural', // Male
      'pt-BR-FranciscaNeural' // Female
    ];
  }
}

/**
 * Check if TTS service is available
 *
 * @returns {Promise<boolean>} True if edge-tts is installed and working
 */
export async function isTTSAvailable() {
  try {
    await execAsync(`${EDGE_TTS_PATH} --version`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Export configuration for external access
export { TTS_CONFIG, EMOTIONAL_TRIGGERS, AUDIO_WORTHY_MOODS };

export default {
  generateAudio,
  generateAudioWithFallback,
  shouldSendAudio,
  getAvailableVoices,
  isTTSAvailable,
  TTS_CONFIG,
  EMOTIONAL_TRIGGERS,
  AUDIO_WORTHY_MOODS
};
