/**
 * JESUS CRISTO BOT - O BOM PASTOR DIGITAL
 * Entry Point para Scalingo (Production)
 *
 * Este arquivo é o main entry point para deployments em Scalingo.
 * Carrega variáveis de ambiente do Scalingo e chama index.js
 *
 * Procfile references: web: node indexScalingo.js
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// VALIDATION & STARTUP CHECKS
// ═══════════════════════════════════════════════════════════════

console.log('='.repeat(60));
console.log('JESUS CRISTO BOT - SCALINGO STARTUP');
console.log('='.repeat(60));

// Required environment variables
const requiredEnvs = ['GEMINI_API_KEY', 'WAHA_URL', 'WAHA_API_KEY'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missingEnvs.join(', ')}`);
    console.error('See deployment/WAHA_PRODUCTION_SETUP.md for setup instructions');
    process.exit(1);
}

// Verify Scalingo detection
const IS_SCALINGO = !!(
    process.env.SCALINGO_POSTGRESQL_URL ||
    process.env.SCALINGO_MONGO_URL ||
    process.env.SCALINGO_REDIS_URL
);

console.log(`Environment Mode: ${IS_SCALINGO ? 'PRODUCTION (Scalingo)' : 'HYBRID'}`);
console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Port: ${process.env.PORT || '8080'}`);

// Database URLs logging (masked for security)
if (process.env.SCALINGO_POSTGRESQL_URL) {
    console.log('Database: PostgreSQL (Scalingo)');
}
if (process.env.SCALINGO_MONGO_URL) {
    console.log('Session Storage: MongoDB (Scalingo)');
}
if (process.env.SCALINGO_REDIS_URL) {
    console.log('Cache: Redis (Scalingo)');
}

// WAHA configuration
console.log(`WAHA Endpoint: ${process.env.WAHA_URL}`);
console.log(`WAHA Session: ${process.env.WAHA_SESSION || 'default'}`);

// ═══════════════════════════════════════════════════════════════
// LOG DIRECTORIES SETUP
// ═══════════════════════════════════════════════════════════════

const logsDir = join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory: ${logsDir}`);
}

// ═══════════════════════════════════════════════════════════════
// IMPORT AND START MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════

console.log('Starting main application...');
console.log('='.repeat(60));
console.log('');

// Import main app (uses config.js which auto-detects environment)
import('./index.js').catch(error => {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM - Starting graceful shutdown...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nReceived SIGINT - Starting graceful shutdown...');
    process.exit(0);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error.message);
    console.error(error.stack);
    // Scalingo will automatically restart the dyno
    process.exit(1);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at', promise, 'reason:', reason);
    // Don't exit - allow app to continue
});
