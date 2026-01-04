# WAHA Production Deployment Guide

**Jesus Cristo Bot** - WhatsApp Pastoral AI Bot
Production deployment on Scalingo using WAHA (WhatsApp HTTP API)

---

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Variables](#environment-variables)
3. [Scalingo Configuration](#scalingo-configuration)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Strategy](#rollback-strategy)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, verify the following:

### Code
- [ ] All tests pass: `npm test`
- [ ] No console.log statements in production code (use Pino logger)
- [ ] Error handling implemented for all critical paths
- [ ] Config.js environment detection working correctly
- [ ] No hardcoded credentials in code or config files

### Database
- [ ] PostgreSQL add-on provisioned in Scalingo
- [ ] MongoDB add-on provisioned in Scalingo
- [ ] Redis add-on provisioned in Scalingo (optional but recommended)
- [ ] Database migrations run successfully
- [ ] Backup strategy established

### WAHA Integration
- [ ] WAHA server deployed and accessible (separate from Scalingo dyno)
- [ ] WAHA_URL is publicly accessible
- [ ] WAHA_API_KEY generated and secure
- [ ] Webhook URL configured in WAHA: `https://your-app.osc-fr1.scalingo.io/webhook/messages`
- [ ] WAHA session initialized and WhatsApp authenticated

### Scalingo Preparation
- [ ] Scalingo app created
- [ ] PostgreSQL add-on attached
- [ ] MongoDB add-on attached
- [ ] Redis add-on attached (optional)
- [ ] Environment variables configured (see below)
- [ ] Git remote added: `git remote add scalingo https://git.osc-fr1.scalingo.io/your-app.git`

### Monitoring & Logging
- [ ] Pino logger configured for JSON output
- [ ] Log drain configured if using external logging service
- [ ] Monitoring dashboard set up (Datadog, New Relic, etc.)
- [ ] Alert thresholds configured for errors, latency, uptime

### Backup & Recovery
- [ ] Database backup schedule configured
- [ ] WAHA session backup strategy established
- [ ] Rollback plan documented and tested
- [ ] Emergency contact list prepared

---

## Environment Variables

### Required Variables (MUST SET IN SCALINGO)

```bash
# Google Gemini API Key
GEMINI_API_KEY=<your-google-gemini-api-key>

# WAHA Configuration (WhatsApp HTTP API)
WAHA_URL=https://vv-xxxx.xxxx.easypanel.host
WAHA_API_KEY=<your-waha-api-key>
WAHA_SESSION=default

# Node Environment
NODE_ENV=production

# Port (Scalingo injects this)
PORT=8080
```

### Optional Variables (Recommended for Production)

```bash
# Bot Configuration
BOT_NAME=Jesus Cristo
SESSION_ID=jesus_bot_session

# Message Processing
DEBOUNCE_TIME=7000
LOG_LEVEL=info

# Follow-up Configuration
FOLLOWUP_ENABLED=true
FOLLOWUP_MIN_HOURS=1
FOLLOWUP_MAX_HOURS=24

# Quiet Hours (no scheduled follow-ups)
QUIET_HOURS_START=22
QUIET_HOURS_END=8

# Rate Limiting
MAX_MESSAGES_PER_MINUTE=10
MAX_MESSAGES_PER_HOUR=100

# Phone Number (for display in dashboard)
PHONE_NUMBER=<your-whatsapp-number>
```

### Scalingo Add-on URLs (Auto-Injected)

These are automatically injected by Scalingo when add-ons are provisioned:
- `SCALINGO_POSTGRESQL_URL` - PostgreSQL connection
- `SCALINGO_MONGO_URL` - MongoDB connection
- `SCALINGO_REDIS_URL` - Redis connection (if provisioned)

**Do NOT set these manually** - Scalingo manages them automatically.

---

## Scalingo Configuration

### 1. Add PostgreSQL Database

```bash
scalingo -a your-app addons-add postgresql-free
```

### 2. Add MongoDB

```bash
scalingo -a your-app addons-add mongodb-free
```

### 3. Add Redis (Recommended)

```bash
scalingo -a your-app addons-add redis-free
```

### 4. Set Environment Variables

```bash
scalingo -a your-app env-set \
  GEMINI_API_KEY="<key>" \
  WAHA_URL="https://vv-xxxx.xxxx.easypanel.host" \
  WAHA_API_KEY="<key>" \
  NODE_ENV="production" \
  LOG_LEVEL="info"
```

Or use Scalingo dashboard: **Settings → Environment variables**

### 5. Configure Procfile

The `Procfile` at project root specifies the startup command:

```
web: node indexScalingo.js
```

This entry point:
- Validates all required environment variables
- Detects Scalingo add-ons automatically
- Routes to correct database adapters
- Starts the Express HTTP server on `$PORT`

---

## Deployment Process

### Step 1: Prepare Code

```bash
# Ensure all changes are committed
git status

# Update version if needed
npm version patch  # or minor/major

# Verify tests pass
npm test

# Build/compile if needed (not required for Node.js/JS)
```

### Step 2: Push to Scalingo

```bash
# Add Scalingo remote (one time only)
git remote add scalingo https://git.osc-fr1.scalingo.io/your-app.git

# Push code to Scalingo (triggers build & deployment)
git push scalingo main

# Or if deploying from different branch:
git push scalingo your-branch:main
```

### Step 3: Monitor Build & Startup

```bash
# View build logs
scalingo -a your-app logs --addon

# View app logs during startup
scalingo -a your-app logs --stream

# Check dyno status
scalingo -a your-app ps
```

**Expected startup sequence:**
1. Build phase: Node dependencies installed
2. Start phase: `node indexScalingo.js` executes
3. indexScalingo.js validates env variables
4. Main app (index.js) starts Express server
5. Server listens on $PORT (usually 8080 mapped to :443 externally)
6. Health check endpoint `/health` returns `{"status":"ok"}`

### Step 4: Configure WAHA Webhook

In WAHA admin panel, configure webhook:
- **URL**: `https://your-app.osc-fr1.scalingo.io/webhook/messages`
- **Events**: message, message_ack
- **Retry**: Enable with exponential backoff

---

## Post-Deployment Verification

### 1. Health Check Endpoints

```bash
# Check app is responding
curl https://your-app.osc-fr1.scalingo.io/health
# Expected: {"status":"ok","waha":true,"mode":"webhook","uptime":XXX}

# Dashboard should load
curl https://your-app.osc-fr1.scalingo.io/
# Expected: HTML dashboard page
```

### 2. Test Message Flow

1. Send a test message via WhatsApp to bot number
2. Check dashboard: message count should increase
3. Verify bot responds within 5-10 seconds
4. Check database: new conversation record created

### 3. View Application Logs

```bash
# Stream live logs
scalingo -a your-app logs --stream

# View last 100 lines
scalingo -a your-app logs | tail -100

# Filter for errors
scalingo -a your-app logs | grep ERROR
```

### 4. Database Connectivity Test

```bash
# Connect to PostgreSQL
scalingo -a your-app db-tunnel SCALINGO_POSTGRESQL_URL

# In another terminal, connect with psql
psql postgresql://username:password@localhost:port/dbname

# Check tables exist
\dt
```

### 5. MongoDB Session Verification

```bash
# Check WhatsApp session saved
db.getCollection('auth_sessions').find({}).limit(1)
```

### 6. Performance Baseline

Monitor for first hour:
- Message processing latency
- WAHA response times
- Database query times
- Error rates
- Memory usage

---

## Rollback Strategy

### Option 1: Git Revert (Recommended)

If recent deployment is problematic:

```bash
# View deployment history
git log --oneline -10

# Revert to previous commit
git revert HEAD

# Push rollback
git push scalingo main

# Scalingo auto-deploys the reverted code
```

### Option 2: Previous Dyno Snapshot

Scalingo keeps recent dyno snapshots:

```bash
# List available snapshots
scalingo -a your-app backups

# Create dyno from snapshot (contact Scalingo support for assistance)
```

### Option 3: Manual Database Restore

If database was corrupted:

```bash
# List database backups
scalingo -a your-app backups --addon postgresql

# Restore to specific point in time
scalingo -a your-app backups-restore <backup-id> --addon postgresql
```

### Rollback Checklist

- [ ] Identify problematic deployment commit
- [ ] Run `git log` to find previous working commit hash
- [ ] Revert with `git revert <bad-commit-hash>`
- [ ] Push to Scalingo
- [ ] Monitor logs and `/health` endpoint
- [ ] Verify message processing resumes
- [ ] Document incident and root cause
- [ ] Plan fix and redeploy

---

## Monitoring & Alerts

### 1. Health Check URL for Load Balancer

Configure your load balancer to use this health check:

```
GET https://your-app.osc-fr1.scalingo.io/health
Expected Status: 200
Expected Body: {"status":"ok","waha":true,...}
Interval: 30 seconds
Timeout: 5 seconds
Healthy Threshold: 2 consecutive successes
Unhealthy Threshold: 3 consecutive failures
```

### 2. Key Metrics to Monitor

```
Infrastructure:
- CPU usage (should be < 60%)
- Memory usage (should be < 80%)
- Disk usage (should be < 70%)
- Dyno uptime (should be > 99.9%)

Application:
- Message processing latency (target: < 2 seconds)
- Error rate (target: < 0.1%)
- HTTP 5xx errors (target: 0)
- Webhook delivery success rate (target: > 99%)

Database:
- PostgreSQL connection pool usage
- MongoDB disk usage
- Query latency (target: < 100ms)
- Slow query log

WAHA:
- Webhook response time (target: < 500ms)
- WAHA API availability (target: > 99.5%)
- Session authentication status
```

### 3. Setup External Monitoring

#### Option A: Scalingo Dashboard (Built-in)
- Go to Scalingo Dashboard → your-app → Analytics
- Monitor dyno metrics in real-time

#### Option B: Datadog Integration

```bash
# Add Datadog log drain
scalingo -a your-app log-drains-add datadog https://http-intake.logs.datadoghq.com/v1/input/<your-dd-api-key>

# View metrics in Datadog dashboard
# Configure monitors for alerts
```

#### Option C: New Relic Integration

```bash
# Add New Relic
scalingo -a your-app addons-add newrelic-free

# APM automatically enabled
# View in New Relic dashboard
```

### 4. Alert Configuration

Setup alerts for:
- **High Error Rate**: > 1% errors in 5 min window
- **High Latency**: > 5 seconds median response time
- **Database Connection Issues**: Connection pool exhausted
- **WAHA Disconnected**: Health check fails 3x in a row
- **Dyno Crashed**: App restart detected
- **Disk Space Low**: > 80% usage

---

## Troubleshooting

### Problem: Health check returns `"waha":false`

**Symptoms**: `/health` endpoint returns `{"status":"ok","waha":false}`

**Root Causes**:
- WAHA server unreachable
- WAHA_URL environment variable incorrect
- WAHA session not authenticated
- Network firewall blocking connection

**Solution**:
```bash
# 1. Verify WAHA_URL is correct
scalingo -a your-app env | grep WAHA_URL

# 2. Test WAHA connectivity from dyno
scalingo -a your-app run bash
curl https://<WAHA_URL>/api/default/me

# 3. If WAHA unreachable, check:
#    - WAHA server is running
#    - Firewall allows outbound HTTPS to WAHA host
#    - WAHA_API_KEY is correct
```

### Problem: Messages not being received

**Symptoms**: Dashboard message count not increasing, WAHA webhook not firing

**Root Causes**:
- Webhook URL not configured in WAHA
- WAHA webhook authentication failing
- Network connectivity issue
- WhatsApp session expired in WAHA

**Solution**:
```bash
# 1. Check WAHA webhook configuration
# Log into WAHA admin panel, verify webhook URL:
# https://your-app.osc-fr1.scalingo.io/webhook/messages

# 2. Check WAHA logs for webhook delivery attempts
# (View in WAHA admin panel)

# 3. Test webhook manually
curl -X POST https://your-app.osc-fr1.scalingo.io/webhook/messages \
  -H "Content-Type: application/json" \
  -d '{"event":"message","data":{"from":"5511999999999","body":"test"}}'

# 4. If WAHA session expired, re-authenticate:
# - Log into WAHA admin
# - Reinitialize WhatsApp session
# - Scan new QR code with phone
```

### Problem: Database connection timeout

**Symptoms**: Logs show `database connection timeout`, messages not saved

**Root Causes**:
- PostgreSQL add-on not provisioned
- Connection pool exhausted
- Database credentials incorrect

**Solution**:
```bash
# 1. Verify add-on provisioned
scalingo -a your-app addons

# 2. Check connection pool settings in config.js
# (default max 10 connections)

# 3. Verify SCALINGO_POSTGRESQL_URL is set
scalingo -a your-app env | grep POSTGRESQL_URL

# 4. Test database connection
scalingo -a your-app db-tunnel SCALINGO_POSTGRESQL_URL
```

### Problem: High memory usage / Dyno crashes

**Symptoms**: Logs show OOM kill, dyno restarts frequently

**Root Causes**:
- Memory leak in code
- Large data structure in memory
- Unbounded conversation history

**Solution**:
```bash
# 1. Check memory usage trend
scalingo -a your-app stats

# 2. Increase dyno size
scalingo -a your-app scale web:2G  # 2GB RAM

# 3. Review memory-heavy operations:
#    - Large embeddings stored in memory
#    - Unbounded array growth in scheduler
#    - Cache not evicting old entries

# 4. Enable memory profiling
NODE_OPTIONS="--expose-gc" scalingo -a your-app restart
```

### Problem: Slow message processing

**Symptoms**: Bot takes > 10 seconds to respond, WAHA delays reported

**Root Causes**:
- Slow Gemini API response
- Database queries slow
- Debounce time too long

**Solution**:
```bash
# 1. Check Gemini API latency
# Review logs for gemini response times

# 2. Optimize database queries
# - Add indexes on frequently queried fields
# - Review slow query log

# 3. Adjust debounce time
scalingo -a your-app env-set DEBOUNCE_TIME=3000

# 4. Profile with Node inspector
scalingo -a your-app run "node --inspect-brk index.js"
```

### Problem: WAHA session lost on dyno restart

**Symptoms**: After dyno restart, bot disconnected, need to rescan QR

**Root Causes**:
- Session stored on ephemeral dyno filesystem
- Session state not persisted to MongoDB

**Solution**:
```bash
# This is expected behavior - restart always requires re-auth

# To minimize restarts:
# 1. Avoid code deployments during peak usage
# 2. Set up Blue-Green deployment for zero-downtime updates
# 3. Use scalingo -a your-app restart-workers instead of restart

# To recover quickly:
# 1. Have standby WhatsApp account ready
# 2. Document WAHA re-authentication steps
# 3. Setup automated re-auth webhook after restart
```

---

## Additional Resources

- **WAHA Documentation**: https://waha.devlike.ru/
- **Scalingo Documentation**: https://doc.scalingo.com/
- **Gemini API**: https://aistudio.google.com/app/apikey
- **Baileys Library**: https://github.com/WhiskeySockets/Baileys
- **Project GitHub**: [Link to your repo]

---

## Support & Escalation

### Emergency Contacts
- **On-Call Engineer**: [Contact info]
- **Scalingo Support**: https://support.scalingo.com/
- **WAHA Support**: [Support channel]

### Incident Response
1. Page on-call engineer
2. Check `/health` endpoint
3. Review application logs: `scalingo -a your-app logs --stream`
4. Check database connectivity
5. Verify WAHA connection status
6. If critical, execute rollback strategy
7. Post-incident: Document root cause and prevention steps

---

**Last Updated**: 2026-01-04
**Version**: 2.0 (WAHA Production Ready)
**Maintained By**: Sistema Jesus Cristo Team
