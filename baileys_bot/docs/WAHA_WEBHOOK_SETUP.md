# WAHA Webhook Configuration Guide

## Overview

This guide explains how to configure and test WAHA (WhatsApp HTTP API) webhooks for Jesus Cristo Bot. The bot uses WAHA's HTTP API instead of Baileys WebSocket for improved reliability, scalability, and maintainability.

**Architecture:**
- WAHA Server: `https://vv-ddas.v8b0on.easypanel.host`
- Bot runs Express HTTP server (port 8080)
- Receives messages via POST webhooks
- Sends messages via WAHA HTTP API calls

---

## 1. Dashboard Access

### WAHA Dashboard URL
```
https://vv-ddas.v8b0on.easypanel.host
```

### What You Can Do

1. **View Sessions** - See all WhatsApp sessions
2. **QR Code Management** - Generate/refresh QR codes for pairing
3. **Session Status** - Check connection health
4. **API Documentation** - Built-in OpenAPI/Swagger docs
5. **Webhook Configuration** - Set webhook URLs and test payloads

### Accessing the Dashboard

```bash
# Open in browser
https://vv-ddas.v8b0on.easypanel.host

# If authentication required, check .env for credentials
# (Usually accessible without auth in dev mode)
```

---

## 2. Webhook Configuration

### Step 1: Determine Your Bot URL

Replace `your-domain.com` with your actual domain:

```
Development:  http://localhost:8080
Staging:      https://staging.your-domain.com
Production:   https://your-domain.com
```

### Step 2: Configure Webhook in WAHA Dashboard

1. Go to WAHA Dashboard
2. Select your session (default: `default`)
3. Navigate to **Webhooks** section
4. Set **Webhook URL** to:

```
POST /webhook/messages → http://your-domain.com/webhook/messages
```

### Step 3: Optional - Set Webhook Headers

Some deployments may require authentication headers:

```json
{
  "Authorization": "Bearer YOUR_BOT_TOKEN",
  "X-Bot-Secret": "your-secret-key"
}
```

Update in `.env`:
```bash
WEBHOOK_SECRET=your-secret-key
```

### Complete Webhook URL Format

```
https://your-domain.com/webhook/messages
```

This endpoint receives JSON payloads like:

```json
{
  "id": "true_5511987654321@c.us_AF8ABC123",
  "timestamp": 1704282000,
  "body": "Hello Jesus Bot",
  "from": "5511987654321@c.us",
  "fromName": "João Silva",
  "pushname": "João",
  "to": "551133334444@c.us",
  "type": "text",
  "mediaType": null
}
```

---

## 3. Environment Variables

Update your `.env` file with WAHA configuration:

```bash
# ═══════════════════════════════════════════════════════════════
# WAHA Configuration
# ═══════════════════════════════════════════════════════════════

# WAHA server base URL
WAHA_URL=https://vv-ddas.v8b0on.easypanel.host

# WAHA API Key for HTTP authentication (if required)
WAHA_API_KEY=7dcbe043adf54656bd7ac2c3f94c7292

# Session name (must match session in WAHA)
WAHA_SESSION=default

# Optional: Bot token for incoming webhook authentication
WEBHOOK_SECRET=your-optional-secret

# Optional: Webhook endpoint path (default: /webhook/messages)
WEBHOOK_PATH=/webhook/messages

# ═══════════════════════════════════════════════════════════════
```

---

## 4. Testing Webhooks

### Test 1: Check WAHA Server Health

```bash
curl -X GET https://vv-ddas.v8b0on.easypanel.host/health \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 1234567
}
```

### Test 2: List Sessions

```bash
curl -X GET "https://vv-ddas.v8b0on.easypanel.host/api/sessions" \
  -H "Content-Type: application/json"
```

Expected response:
```json
[
  {
    "name": "default",
    "status": "CONNECTED",
    "me": {
      "id": "551133334444@c.us",
      "name": "Jesus Cristo Bot"
    }
  }
]
```

### Test 3: Send Test Message via WAHA

```bash
curl -X POST https://vv-ddas.v8b0on.easypanel.host/api/default/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "5511987654321@c.us",
    "text": "Test message from WAHA API"
  }'
```

### Test 4: Get QR Code for Pairing

```bash
# Get as image
curl -X GET "https://vv-ddas.v8b0on.easypanel.host/api/default/auth/qr?format=image" \
  -o qr-code.png

# Get as raw data (for terminal display)
curl -X GET "https://vv-ddas.v8b0on.easypanel.host/api/default/auth/qr?format=raw" \
  -H "Content-Type: application/json"
```

### Test 5: Send Webhook Test Payload to Your Bot

```bash
# Test webhook endpoint directly
curl -X POST http://localhost:8080/webhook/messages \
  -H "Content-Type: application/json" \
  -d '{
    "id": "true_5511987654321@c.us_AF8ABC123",
    "timestamp": 1704282000,
    "body": "Hello Jesus Bot, can you help me?",
    "from": "5511987654321@c.us",
    "fromName": "João Silva",
    "pushname": "João",
    "to": "551133334444@c.us",
    "type": "text",
    "mediaType": null
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Message received and queued for processing"
}
```

---

## 5. Webhook Payload Types

The bot receives different payload types:

### Text Message

```json
{
  "id": "true_5511987654321@c.us_AF8ABC123",
  "timestamp": 1704282000,
  "body": "Hello",
  "from": "5511987654321@c.us",
  "fromName": "João",
  "pushname": "João Silva",
  "to": "551133334444@c.us",
  "type": "text"
}
```

### Audio Message

```json
{
  "id": "true_5511987654321@c.us_AF8ABC124",
  "timestamp": 1704282005,
  "from": "5511987654321@c.us",
  "to": "551133334444@c.us",
  "type": "audio",
  "mediaType": "audio/ogg; codecs=opus",
  "media": {
    "url": "https://waha-server/download/....",
    "mimetype": "audio/ogg; codecs=opus"
  }
}
```

### Contact Message

```json
{
  "id": "true_5511987654321@c.us_AF8ABC125",
  "timestamp": 1704282010,
  "from": "5511987654321@c.us",
  "to": "551133334444@c.us",
  "type": "contacts",
  "contacts": [
    {
      "firstName": "Maria",
      "phoneNumber": "5511999999999"
    }
  ]
}
```

---

## 6. Webhook Processing Flow

```
[WAHA Server detects message]
           ↓
[POST /webhook/messages]
           ↓
[index.js receives payload]
           ↓
[Message buffered by JID (Debounce 7-10s)]
           ↓
[conversationController.handleConversation]
           ↓
[Load user profile + context]
           ↓
[Process with Gemini AI]
           ↓
[whatsappSender.sendMessage via WAHA HTTP API]
           ↓
[Message queued with humanized delay]
           ↓
[WAHA sends to WhatsApp]
```

---

## 7. Troubleshooting

### Issue: Webhooks not being received

**Check:**
1. Is WAHA server running?
   ```bash
   curl -I https://vv-ddas.v8b0on.easypanel.host
   ```

2. Is your bot server accessible?
   ```bash
   curl -I http://localhost:8080
   ```

3. Is webhook URL correctly configured in WAHA dashboard?
   - Verify URL in dashboard matches your `.env`
   - Try testing with curl first

4. Check bot logs:
   ```bash
   tail -f logs/jesus-bot.log | grep webhook
   ```

### Issue: Messages sent but not received on WhatsApp

**Check:**
1. Session status:
   ```bash
   curl https://vv-ddas.v8b0on.easypanel.host/api/sessions
   ```
   Status should be `CONNECTED`

2. WAHA API key is correct:
   - Verify `WAHA_API_KEY` in `.env`
   - Verify in WAHA dashboard

3. Message format is valid:
   - Phone number must include country code (e.g., `5511987654321@c.us`)
   - Message text should be UTF-8 encoded

4. Check WAHA logs:
   ```bash
   # Access WAHA container logs (if using Docker)
   docker logs waha-container-name
   ```

### Issue: 401 Unauthorized errors

**Solutions:**
1. Verify `WAHA_API_KEY`:
   ```bash
   # In .env
   WAHA_API_KEY=7dcbe043adf54656bd7ac2c3f94c7292
   ```

2. Check if API key is being sent in headers:
   - `wahaClient.js` automatically includes it
   - Should appear in request headers as: `Authorization: Bearer YOUR_KEY`

3. Generate new API key in WAHA dashboard

### Issue: Rate limiting (429 errors)

**Solutions:**
1. Reduce message frequency
2. Increase debounce time in `.env`:
   ```bash
   DEBOUNCE_TIME=15000  # 15 seconds
   ```
3. Check WAHA rate limits (usually 60 msg/min per session)

### Issue: Connection keeps dropping

**Troubleshooting:**
1. QR code may have expired:
   ```bash
   curl https://vv-ddas.v8b0on.easypanel.host/api/default/auth/qr?format=raw
   ```

2. Re-authenticate phone number:
   - Get new QR code
   - Scan with WhatsApp phone
   - Restart bot

3. Check WAHA server logs for crashes

---

## 8. Webhook Security

### Authentication (Optional but Recommended)

Enable webhook signature verification:

**In .env:**
```bash
WEBHOOK_SECRET=your-secret-key
```

**WAHA will sign requests with:**
```
X-Webhook-Signature: sha256=...
```

**Verify in bot:**
```javascript
// index.js webhook handler
const crypto = require('crypto');

app.post('/webhook/messages', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (`sha256=${hash}` !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Continue processing...
});
```

### IP Whitelist (Optional)

Restrict webhook requests to WAHA IPs:

```bash
# .env
WAHA_ALLOWED_IPS=192.168.1.1,10.0.0.0/8
```

---

## 9. Monitoring & Debugging

### Enable Webhook Logging

```bash
# In .env
LOG_LEVEL=debug
WEBHOOK_DEBUG=true
```

### Monitor Webhook Queue

The bot maintains a debounce queue by JID. Check via dashboard:
```javascript
// Check queue size
console.log(messageBuffer.size);
```

### Test Webhook Endpoint Health

```bash
curl -X GET http://localhost:8080/health \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "webhooks_processed": 1234,
  "sessions": ["default"],
  "db": "connected"
}
```

---

## 10. Production Deployment Checklist

- [ ] WAHA server URL set to production domain
- [ ] WAHA API key configured in environment
- [ ] Webhook URL points to production domain
- [ ] SSL/TLS certificate valid
- [ ] Bot server is accessible from internet
- [ ] Webhook secret configured for authentication
- [ ] Rate limiting configured
- [ ] Error logging enabled
- [ ] Monitoring alerts set up
- [ ] Database backups enabled
- [ ] Scheduled follow-ups tested
- [ ] Load tested with 100+ concurrent users

---

## 11. API Reference

### Sending a Message

```bash
curl -X POST https://vv-ddas.v8b0on.easypanel.host/api/default/sendMessage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "chatId": "5511987654321@c.us",
    "text": "Your message here",
    "quotedMessageId": "optional_quoted_msg_id"
  }'
```

### Sending Media

```bash
curl -X POST https://vv-ddas.v8b0on.easypanel.host/api/default/sendFile \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@/path/to/image.jpg" \
  -F "chatId=5511987654321@c.us" \
  -F "caption=Optional caption"
```

### Get Chat History

```bash
curl -X GET "https://vv-ddas.v8b0on.easypanel.host/api/default/chats/5511987654321@c.us/messages" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Mark Message as Read

```bash
curl -X POST https://vv-ddas.v8b0on.easypanel.host/api/default/markAsRead \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "messageId": "message_id_here"
  }'
```

---

## 12. Documentation Links

- **WAHA Official Docs**: https://waha.devlike.ru/
- **WAHA GitHub**: https://github.com/devlikeapro/waha
- **OpenAPI/Swagger**: `https://vv-ddas.v8b0on.easypanel.host/api-docs`
- **Jesus Bot CLAUDE.md**: See project CLAUDE.md for architecture overview

---

## Support & Issues

If experiencing issues:

1. **Check logs**: `tail -f logs/*.log`
2. **Verify configuration**: Compare `.env` with `.env.example`
3. **Test manually**: Use curl commands above
4. **Check WAHA dashboard**: Status page shows connection health
5. **Review recent commits**: See what changed recently

---

**Last Updated:** 2026-01-04
**Bot Architecture:** WAHA HTTP API (not Baileys)
**Session Name:** default
**Dashboard:** https://vv-ddas.v8b0on.easypanel.host
