# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Jesus Cristo Bot** is a WhatsApp pastoral AI bot built with Baileys and Google Gemini. It provides spiritual guidance, prayer support, biblical teachings, and community features to users through WhatsApp. The project supports both local SQLite development and production deployment on Scalingo (PostgreSQL/MongoDB/Redis).

## Core Architecture

### Entry Points
- **index.js** - Main orchestrator: Baileys WebSocket connection, HTTP dashboard (port 8080), message routing, scheduler initialization
- Supports two connection modes: QR Code or pairing code (set `USE_PAIRING_CODE=true`)

### Key Modules by Function

**Message Processing & Conversation**
- `conversationController.js` - Core conversation logic, handles crisis detection, user profiling, feature routing
- `whatsappSender.js` - Message sending with delays/humanization
- `messageRouter.js` - Routes incoming messages to appropriate features
- `flowUtils.js` - Urgency detection, text normalization, contact extraction

**User Data & Database**
- `database.js` - SQLite initialization (local development)
- `databasePg.js` - PostgreSQL adapter (Scalingo production)
- `mongoState.js` - MongoDB for WhatsApp session state and embeddings/vectors
- Schema: `usuarios` (user profiles), `conversas` (conversation history), `agendamentos` (scheduled follow-ups), `user_deep_profile` (spiritual journey tracking)

**AI & NLP**
- `gemini.js` - Google Gemini API wrapper for text generation
- `memoria.js` - User memory/context building from conversation history
- `knowledgeBase.js` - Biblical search and knowledge retrieval
- `gemini_core/emotion.js` - Emotion detection and response calibration
- `gemini_core/resilience.js` - Resilience scoring and coping strategy suggestions

**Behavioral & Smart Features**
- `behaviorAnalyzer.js` - Tracks user presence, patterns, engagement metrics
- `nudgeManager.js` - Intelligent follow-up timing based on presence detection
- `scheduler.js` - Cron-based follow-up message scheduling (respects quiet hours 22:00-08:00)
- `followupRecovery.js` - Recovery logic when scheduled messages fail
- `experienceEnhancer.js` - Crisis detection, special response handling

**Specialized Features (v2.0)**
- `features/devocional.js` - Daily devotional delivery
- `features/pedidosOracao.js` - Prayer request management and community sharing
- `features/planosLeitura.js` - Bible reading plans
- `features/quizBiblico.js` - Biblical quiz with streak tracking
- `features/evangelismoGuiado.js` - Guided evangelism flows
- `features/comunidade.js` - Community connection features

**Teaching & Content**
- `core/teachingEngine.js` - Manages progressive biblical teachings
- `prompts/jornada.js` - Spiritual journey level detection (iniciante → aprofundado → avançado)
- Various prompt files in `/prompts` - Content for parables, teachings, challenges

**Audio Processing**
- `audioProcessor.js` - Audio message transcription via Gemini

**Dashboard**
- HTML template embedded in `index.js` - Shows connection status, pairing code, soul view, stats

## Development Commands

```bash
# Start the bot
npm start

# Watch mode (auto-restart on file changes)
npm dev

# Migrate database schema
npm run migrate
```

## Configuration

Copy `.env.example` to `.env`. Required:
- `GEMINI_API_KEY` - Google Gemini API key from https://aistudio.google.com/app/apikey

Common optional settings:
- `USE_PAIRING_CODE=true` - Use phone pairing instead of QR
- `PHONE_NUMBER=55119...` - Phone number for pairing code
- `DEBOUNCE_TIME=7000` - Message debounce window (accumulate messages before processing)
- `NODE_ENV=production` - Set for production
- For Scalingo: `SCALINGO_POSTGRESQL_URL`, `SCALINGO_MONGO_URL`, `SCALINGO_REDIS_URL` (auto-configured)

## Database Layer Architecture

**Local Development:**
- `database.js` uses SQLite with better-sqlite3
- Database file: `data/jesus.db`
- Supports immediate testing without external services

**Production (Scalingo):**
- `databasePg.js` uses PostgreSQL for user profiles and conversation history
- `mongoState.js` uses MongoDB for WhatsApp session state and embeddings
- Automatic environment detection in `config.js` via `IS_SCALINGO` flag

**Key Tables:**
- `usuarios` - User profiles with spiritual level, contact info, preferences
- `conversas` - Conversation history for context building
- `agendamentos` - Scheduled follow-ups and prayer reminders
- `user_deep_profile` - Deep profiling: core pain, core hope, spiritual stage, personality traits

## Message Flow

1. **Incoming Message (index.js)** → Extract text/audio/contacts → Debounce into buffer
2. **Debounce Timer (7s default)** → Fires after message silence
3. **handleConversation (conversationController.js)** → Main logic:
   - Crisis detection → emergency response
   - Extract simple topics locally (familia, trabalho, fe, etc.)
   - Load user profile from DB
   - Generate context using memoria.js
   - Route to appropriate feature (quiz, devotional, prayer, teaching)
   - Call Gemini for response generation with user context
   - Add conversation to history
   - Send response via whatsappSender
   - Schedule follow-ups via scheduler

4. **Sending** → Humanization delays (low/medium/high) → Message queuing via whatsappSender

## Important Implementation Details

### Urgency & Debounce
- `flowUtils.detectUrgency()` calculates urgency score from keywords (ajuda, emergency, morte, etc.)
- Adjusts debounce window: crisis = 0ms, high = 3s, normal = 7s
- Prevents delayed responses to urgent messages

### User Context & Memory
- `memoria.js` builds context by retrieving recent conversations (last 5-10)
- Embeddings stored in MongoDB for semantic search
- Persona/personality traits inform response tone

### Behavior Analysis
- `behaviorAnalyzer.js` tracks: presence status, message frequency, topic preferences
- Notifies scheduler for smart follow-up timing
- Prevents spam via presence detection (don't nudge if user just read a message)

### Crisis Handling
- `experienceEnhancer.js` detects suicide/self-harm indicators
- Immediate response with emergency resources
- Logs as critical incident in journey tracking

### Quiet Hours
- Scheduler respects `QUIET_HOURS_START=22` to `QUIET_HOURS_END=8`
- No automated follow-ups during quiet hours
- Manual messages still send immediately

## Testing

Test files exist in `/tests`:
- `test_oracoes.js` - Prayer feature tests
- `test-gemini.js` - Gemini API integration test
- `test_memoria.js` - Memory building test

Run tests directly:
```bash
node tests/test_oracoes.js
```

## Deployment Notes (Scalingo)

1. **PostgreSQL Add-on** → `databasePg.js` reads `SCALINGO_POSTGRESQL_URL`
2. **MongoDB Add-on** → `mongoState.js` reads `SCALINGO_MONGO_URL`
3. **Redis Add-on** → `config.js` reads `SCALINGO_REDIS_URL`
4. Environment auto-detection: if any Scalingo URL present, switches to production adapters
5. WhatsApp session saved to MongoDB (survives app restart)
6. HTTP dashboard runs on `$PORT` environment variable

## Code Style & Patterns

- **Modular exports**: Each module exports named functions or object of functions
- **Error handling**: Try-catch with fallbacks; non-critical failures log but don't crash
- **Async/await**: Preferred over callbacks
- **Gemini API calls**: Wrapped in `gemini.js` with retry logic
- **Database**: Use `db.prepare()` for SQLite (synchronous, concurrent-safe); PostgreSQL uses Pg client with connection pooling
- **WhatsApp messages**: Always route through `sender.sendMessage()` for consistent delays

## Common Workflows

**Adding a New Feature**
1. Create file in `/features` (e.g., `features/myFeature.js`)
2. Export handler function: `export async function handle(sock, jid, user, context) { ... }`
3. Add routing in `messageRouter.js` or `conversationController.js`
4. Import and call from appropriate location

**Modifying User Profiling**
1. Extend schema in `database.js` and `databasePg.js`
2. Update `user_deep_profile` logic in `conversationController.js`
3. Test with local SQLite first, then PostgreSQL

**Changing Message Delays**
1. Edit `DELAYS` object in `config.js`
2. Pass level to `sender.sendMessage(sock, jid, msg, 'high')` etc.

**Testing Gemini Integration**
1. Ensure `GEMINI_API_KEY` is set
2. Run `node test-gemini.js`
3. Check `gemini.js` for prompt structure and error handling

## Gotchas

- **Message splitting**: WhatsApp enforces message length limits; very long responses auto-split
- **Session loss**: Happens if auth_session directory deleted; requires new QR/pairing code
- **Debounce timing**: Users sending rapid messages may see single consolidated response
- **Quiet hours**: Apply only to *scheduled* follow-ups, not manual responses
- **Gemini rate limits**: Monitor API quota; fallback responses available in `config.js`
- **MongoDB embedding**: Slow for large conversation histories; pagination recommended

## Useful References

- **Baileys**: White-label WhatsApp library for Node.js
- **Better-SQLite3**: Synchronous SQLite for development
- **Pino**: Structured JSON logging
- **Gemini API**: Google's multimodal AI (text, audio, images)
- **Socket.io equivalent**: Baileys uses native WhatsApp protocol via Chromium

---

*Last updated: 2026-01-04*
