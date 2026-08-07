# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Jesus Cristo Bot** is a WhatsApp pastoral AI bot built with WAHA (WhatsApp HTTP API) and Google Gemini. It provides spiritual guidance, prayer support, biblical teachings, and community features to users through WhatsApp. The project supports both local SQLite development and production deployment on Scalingo (PostgreSQL/MongoDB/Redis).

## Core Architecture

### Entry Points
- **index.js** - Main orchestrator: Express HTTP server (port 8080) with webhook endpoints, message routing, scheduler initialization
- **indexScalingo.js** - Production entry point with environment validation and graceful shutdown for Scalingo deployment
- Architecture: WAHA HTTP webhooks (not WebSocket - migrated from Baileys in Jan 2026)

### Message Flow (HTTP Webhooks)

1. **WAHA Server** → Sends POST to `/webhook/messages` when user sends WhatsApp message
2. **Webhook Handler (index.js)** → Receives payload, extracts text/audio/contacts, debounces messages
3. **Debounce Timer (7s default)** → Fires after message silence, accumulates rapid messages
4. **handleConversation (conversationController.js)** → Core processing:
   - Crisis detection → emergency response
   - Extract topics locally (familia, trabalho, fé)
   - Load user profile from database
   - Build context using memoria.js (recent conversations + embeddings)
   - Route to feature handlers (quiz, devotional, prayer, teaching)
   - Generate response via Gemini API
   - Save conversation to history
   - Send response via whatsappSender → wahaClient → WAHA HTTP API
   - Schedule follow-ups via scheduler
5. **Sending** → Humanization delays (low/medium/high) → Message queuing → WAHA API

### Key Modules by Function

**WAHA Integration**
- `wahaClient.js` - HTTP adapter for WAHA API (send messages, get session status, health checks)
- `src/wahaClient.js` - Alternative client implementation with retry logic
- Webhook endpoint: POST `/webhook/messages` in index.js
- Health endpoint: GET `/health` for load balancer monitoring

**Message Processing & Conversation**
- `conversationController.js` - Core conversation logic: crisis detection, user profiling, feature routing
- `whatsappSender.js` - Message sending with delays/humanization, uses wahaClient
- `flowUtils.js` - Urgency detection, text normalization, contact extraction
- `experienceEnhancer.js` - Crisis detection, special response handling

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
- HTML template embedded in `index.js` - Shows connection status, WAHA health, stats, soul view

## Development Commands

```bash
# Start the bot (development)
npm start

# Watch mode (auto-restart on file changes)
npm run dev

# Run all tests (58 tests: WAHA client + webhook handlers)
npm test

# Run specific test suites
npm run test:waha      # WAHA client tests only
npm run test:webhook   # Webhook handler tests only

# Migrate database schema
npm run migrate
```

## Configuration

Copy `.env.example` to `.env`. Required:
- `GEMINI_API_KEY` - Google Gemini API key from https://aistudio.google.com/app/apikey
- `WAHA_URL` - WAHA server URL (e.g., `https://waha.example.com`)
- `WAHA_API_KEY` - WAHA API authentication key
- `WAHA_SESSION` - WhatsApp session name (default: `default`)

Common optional settings:
- `DEBOUNCE_TIME=7000` - Message debounce window (accumulate messages before processing)
- `NODE_ENV=production` - Set for production
- `LOG_LEVEL=info` - Logging level (debug, info, warn, error)
- For Scalingo: `SCALINGO_POSTGRESQL_URL`, `SCALINGO_MONGO_URL`, `SCALINGO_REDIS_URL` (auto-configured by add-ons)

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

## Important Implementation Details

### WAHA Integration
- WAHA server must be configured to send webhooks to `https://your-domain.com/webhook/messages`
- wahaClient.js sends messages via POST to `WAHA_URL/api/{session}/messages/text`
- Session state persisted in MongoDB (survives app restarts)
- Health check endpoint `/health` for load balancer monitoring
- See `docs/WAHA_WEBHOOK_SETUP.md` for webhook configuration guide

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

Comprehensive test suite with 58 tests (100% pass rate):

```bash
# Run all tests
npm test

# Individual test suites
npm run test:waha      # 22 tests - WAHA client adapter
npm run test:webhook   # 36 tests - webhook payload handling
```

Test coverage:
- WAHA HTTP client operations (send, retry, failure handling)
- Webhook payload validation and processing
- JID (Jabber ID) normalization for WhatsApp format
- Message types: text, audio, image, location, contact
- Edge cases: empty messages, special characters, long text
- Multi-user scenarios and context preservation

Test fixtures in `/tests/fixtures/wahaEvents.json` provide realistic WAHA event examples.

Legacy test files:
- `test_oracoes.js` - Prayer feature tests
- `test-gemini.js` - Gemini API integration test
- `test_memoria.js` - Memory building test

## Deployment (Scalingo)

See `deployment/README.md` for complete deployment guide.

**Quick deployment:**
```bash
# Set environment variables in Scalingo dashboard
scalingo -a your-app env-set GEMINI_API_KEY=xxx WAHA_URL=xxx WAHA_API_KEY=xxx

# Deploy
git push scalingo main

# Verify
curl https://your-app.osc-fr1.scalingo.io/health
```

**Key deployment files:**
- `Procfile` - Defines startup command: `web: node indexScalingo.js`
- `indexScalingo.js` - Validates environment, handles graceful shutdown
- `deployment/deploy.sh` - Automated deployment script with health checks
- `deployment/DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment checklist

**Environment auto-detection:**
- If any `SCALINGO_*` URL present, switches to production adapters
- PostgreSQL Add-on → `databasePg.js` reads `SCALINGO_POSTGRESQL_URL`
- MongoDB Add-on → `mongoState.js` reads `SCALINGO_MONGO_URL`
- Redis Add-on → `config.js` reads `SCALINGO_REDIS_URL`

## Code Style & Patterns

- **Modular exports**: Each module exports named functions or object of functions
- **Error handling**: Try-catch with fallbacks; non-critical failures log but don't crash
- **Async/await**: Preferred over callbacks
- **Gemini API calls**: Wrapped in `gemini.js` with retry logic
- **Database**: Use `db.prepare()` for SQLite (synchronous, concurrent-safe); PostgreSQL uses pg client with connection pooling
- **WhatsApp messages**: Always route through `sender.sendMessage()` → `wahaClient.sendMessage()` for consistent delays

## Common Workflows

**Adding a New Feature**
1. Create file in `/features` (e.g., `features/myFeature.js`)
2. Export handler function: `export async function handle(sock, jid, user, context) { ... }`
   - Note: `sock` refers to WAHA client (not Baileys socket)
3. Add routing in `conversationController.js`
4. Import and call from appropriate location

**Modifying User Profiling**
1. Extend schema in `database.js` and `databasePg.js`
2. Update `user_deep_profile` logic in `conversationController.js`
3. Test with local SQLite first, then PostgreSQL

**Changing Message Delays**
1. Edit `DELAYS` object in `config.js`
2. Pass level to `sender.sendMessage(sock, jid, msg, 'high')` etc.

**Testing WAHA Integration**
1. Ensure `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` are set
2. Run `npm run test:waha` to test client adapter
3. Run `npm run test:webhook` to test webhook handling
4. Check `wahaClient.js` for request structure

**Testing Gemini Integration**
1. Ensure `GEMINI_API_KEY` is set
2. Run `node test-gemini.js`
3. Check `gemini.js` for prompt structure and error handling

## Gotchas

- **Message splitting**: WhatsApp enforces message length limits; very long responses auto-split
- **Session persistence**: WAHA session state stored in MongoDB; survives app restarts
- **Debounce timing**: Users sending rapid messages may see single consolidated response
- **Quiet hours**: Apply only to *scheduled* follow-ups, not manual responses
- **Gemini rate limits**: Monitor API quota; fallback responses available in `config.js`
- **MongoDB embedding**: Slow for large conversation histories; pagination recommended
- **WAHA webhook configuration**: Must configure webhook URL in WAHA admin panel before messages work
- **JID normalization**: Phone numbers must be normalized to WhatsApp format (add @s.whatsapp.net for individuals, @g.us for groups)

## Migration Notes

**Baileys → WAHA Migration (Jan 2026):**
- Migrated from Baileys WebSocket to WAHA HTTP API
- WebSocket connection replaced with Express HTTP webhook endpoints
- `sock` parameter in feature handlers now refers to WAHA client, not Baileys socket
- Old QR/pairing code authentication replaced with WAHA session management
- See `WAHA_MIGRATION_CHECKLIST.md` for complete migration details

## Useful References

- **WAHA**: WhatsApp HTTP API - https://waha.devlike.ru/
- **Better-SQLite3**: Synchronous SQLite for development
- **Pino**: Structured JSON logging
- **Gemini API**: Google's multimodal AI (text, audio, images)
- **Scalingo**: PaaS hosting platform - https://scalingo.com/

---

*Last updated: 2026-01-06*
