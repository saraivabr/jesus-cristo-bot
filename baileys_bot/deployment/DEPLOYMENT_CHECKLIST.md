# Deployment Checklist - Jesus Cristo Bot

Quick checklist for deploying to Scalingo production.

## Pre-Deployment (30 minutes before deploy)

### Code & Tests
- [ ] Run tests: `npm test`
- [ ] No console.log in production code
- [ ] Lint check: `npm run lint` (if configured)
- [ ] Security audit: `npm audit`

### Environment Setup
- [ ] `.env.example` updated with all needed variables
- [ ] Sensitive keys NOT in git or code
- [ ] WAHA server up and running at WAHA_URL
- [ ] WAHA session authenticated (WhatsApp QR scanned)

### Database
- [ ] PostgreSQL add-on provisioned in Scalingo
- [ ] MongoDB add-on provisioned in Scalingo
- [ ] Redis add-on provisioned (optional, but recommended)
- [ ] Run migrations: `npm run migrate`
- [ ] Backup existing database (if migrating from old version)

### Git
- [ ] All changes committed
- [ ] `git status` shows clean working tree
- [ ] Latest main branch pulled: `git pull origin main`

---

## Deployment (5 minutes)

### Step 1: Set Environment Variables
```bash
scalingo -a your-app env-set \
  GEMINI_API_KEY="your-key" \
  WAHA_URL="https://vv-xxxx.xxxx.easypanel.host" \
  WAHA_API_KEY="your-key" \
  NODE_ENV="production" \
  LOG_LEVEL="info"
```
- [ ] All variables set successfully
- [ ] No errors returned

### Step 2: Deploy Code
```bash
git push scalingo main
```
- [ ] Push completes without error
- [ ] Build phase succeeds (watch logs)
- [ ] App starts successfully

### Step 3: Monitor Startup
```bash
scalingo -a your-app logs --stream
```
- [ ] No critical errors in startup logs
- [ ] "JESUS CRISTO BOT - SCALINGO STARTUP" message appears
- [ ] All required env variables validated
- [ ] Express server starts on PORT 8080
- [ ] "Starting main application..." message appears
- [ ] Look for uptime timer starting

---

## Post-Deployment (15 minutes)

### Health Verification
- [ ] Health check passes: `curl https://your-app.osc-fr1.scalingo.io/health`
- [ ] Dashboard loads: `https://your-app.osc-fr1.scalingo.io/`
- [ ] WAHA status shows as connected

### Functional Testing
- [ ] Send test WhatsApp message to bot
- [ ] Message count increases on dashboard
- [ ] Bot responds within 10 seconds
- [ ] Response is appropriate and well-formed
- [ ] Check database for conversation record

### Database Verification
- [ ] PostgreSQL accessible and queries fast
- [ ] MongoDB session data persisted
- [ ] Redis cache working (if provisioned)

### Monitoring Setup
- [ ] Log drain active (if using external logging)
- [ ] Alerts configured in Datadog/New Relic (if using)
- [ ] Health check endpoint monitored by load balancer

---

## Rollback Plan (if needed)

If deployment fails or causes issues:

```bash
# Option 1: Revert code
git revert HEAD
git push scalingo main

# Option 2: Restart current version
scalingo -a your-app restart

# Option 3: Scale down and back up (resets memory)
scalingo -a your-app scale web:512M
scalingo -a your-app scale web:2G
```

---

## Known Issues & Solutions

### WAHA shows as disconnected
- Verify WAHA_URL and WAHA_API_KEY in Scalingo env
- Check WAHA server is actually running
- WAHA session may need re-authentication (re-scan QR)

### Messages not appearing
- Check webhook URL configured in WAHA admin
- Verify firewall allows inbound webhooks
- Test webhook manually with curl command

### High memory usage
- Check for memory leaks in code
- Reduce conversation history size
- Scale to larger dyno (2G or 4G)

### Database connection errors
- Verify SCALINGO_POSTGRESQL_URL auto-injected
- Check PostgreSQL add-on is active
- Review connection pool settings

---

## Success Criteria

Deployment is successful when:
1. ✅ Code deployed without errors
2. ✅ Health check returns 200 OK with waha: true
3. ✅ Dashboard accessible and shows connection status
4. ✅ Test message processed within 10 seconds
5. ✅ Bot responds with appropriate message
6. ✅ New conversation saved to database
7. ✅ No error spam in logs
8. ✅ Memory usage stable (under 500MB)
9. ✅ CPU usage normal (under 50%)

---

## Rollback Verification

After rollback, verify:
- [ ] Health check passes
- [ ] Dashboard accessible
- [ ] Previous version message flows work
- [ ] Database not corrupted
- [ ] No data loss

---

## Post-Incident

1. Document what went wrong
2. Root cause analysis
3. Implement fix on dev branch
4. Test thoroughly locally
5. Deploy to staging first (if available)
6. Plan and execute re-deployment with monitoring

---

**Time Estimate**: 45-60 minutes total (15 min pre + 5 min deploy + 15 min verify + 10 min cleanup)
**Optimal Deploy Window**: Low traffic hours (2-4 AM in target timezone)
**Rollback Time**: 5-10 minutes if needed

Keep this file close during deployments!
