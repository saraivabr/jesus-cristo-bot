# Deployment - Jesus Cristo Bot

Production deployment resources for deploying Jesus Cristo Bot to Scalingo.

## Files in this Directory

### Documentation
- **WAHA_PRODUCTION_SETUP.md** - Complete production deployment guide
  - Pre-deployment checklist
  - Environment variable setup
  - Scalingo configuration
  - Deployment process step-by-step
  - Post-deployment verification
  - Rollback strategies
  - Monitoring and alerting setup
  - Troubleshooting guide

- **DEPLOYMENT_CHECKLIST.md** - Quick reference checklist
  - Pre-deployment tasks (30 min)
  - Deployment steps (5 min)
  - Post-deployment verification (15 min)
  - Rollback procedures
  - Success criteria

### Scripts
- **deploy.sh** - Automated deployment script
  - Prerequisites checking
  - Code validation
  - Health checks
  - Environment setup
  - Deployment execution
  - Rollback support
  - Comprehensive logging

### Configuration
- **.env.production.example** - Environment variables template
  - All required variables documented
  - Production best practices
  - Optional monitoring integrations

## Quick Start

### First Time Deployment

1. **Read the setup guide**
   ```bash
   cat WAHA_PRODUCTION_SETUP.md
   ```

2. **Prepare Scalingo app**
   ```bash
   # Add PostgreSQL
   scalingo -a your-app addons-add postgresql-free

   # Add MongoDB
   scalingo -a your-app addons-add mongodb-free

   # Add Redis (recommended)
   scalingo -a your-app addons-add redis-free

   # Add git remote
   git remote add scalingo https://git.osc-fr1.scalingo.io/your-app.git
   ```

3. **Create environment file**
   ```bash
   cp .env.production.example .env.production
   # Edit with actual values:
   nano .env.production
   ```

4. **Deploy using script**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh --app your-app --env .env.production --monitor
   ```

### Standard Deployment

For subsequent deployments:

```bash
# With automated script
./deployment/deploy.sh --app your-app --monitor

# Or manual git push
git push scalingo main
```

### Deployment Monitoring

Watch deployment logs in real-time:

```bash
scalingo -a your-app logs --stream
```

Health check:

```bash
curl https://your-app.osc-fr1.scalingo.io/health
```

## Script Usage

### Basic Deployment

```bash
./deploy.sh --app jesus-bot-prod
```

### With Custom Environment File

```bash
./deploy.sh --app jesus-bot-prod --env deployment/.env.production
```

### Dry Run (Preview Changes)

```bash
./deploy.sh --app jesus-bot-prod --dry-run
```

### With Monitoring

```bash
./deploy.sh --app jesus-bot-prod --monitor
```

### Rollback to Previous Version

```bash
./deploy.sh --app jesus-bot-prod --rollback
```

### Health Check Only

```bash
./deploy.sh --app jesus-bot-prod --health
```

### Skip Confirmations

```bash
./deploy.sh --app jesus-bot-prod --force
```

## Environment Variables Required

| Variable | Required | Example |
|----------|----------|---------|
| GEMINI_API_KEY | Yes | `AIzaSy...` |
| WAHA_URL | Yes | `https://vv-xxxx.easypanel.host` |
| WAHA_API_KEY | Yes | `7dcbe043...` |
| WAHA_SESSION | Yes | `default` |
| NODE_ENV | Yes | `production` |
| BOT_NAME | No | `Jesus Cristo` |
| LOG_LEVEL | No | `info` |
| QUIET_HOURS_START | No | `22` |
| QUIET_HOURS_END | No | `8` |

See `.env.production.example` for complete list.

## Pre-Deployment Checklist

Before deploying:

- [ ] All code committed to git
- [ ] WAHA server deployed and accessible
- [ ] WAHA session authenticated (WhatsApp QR scanned)
- [ ] PostgreSQL add-on provisioned
- [ ] MongoDB add-on provisioned
- [ ] Environment variables set in Scalingo
- [ ] WAHA webhook URL configured in WAHA admin
- [ ] Tests passing (if applicable)
- [ ] No critical errors in code review
- [ ] Database backup taken

See `DEPLOYMENT_CHECKLIST.md` for full checklist.

## Post-Deployment Verification

After deployment:

1. **Health Check**
   ```bash
   curl https://your-app.osc-fr1.scalingo.io/health
   # Expected: {"status":"ok","waha":true,...}
   ```

2. **Dashboard**
   ```
   https://your-app.osc-fr1.scalingo.io/
   ```

3. **Send Test Message**
   - Send WhatsApp message to bot
   - Verify response within 10 seconds
   - Check dashboard message count increases

4. **Database Verification**
   ```bash
   scalingo -a your-app db-tunnel SCALINGO_POSTGRESQL_URL
   # In psql: SELECT count(*) FROM conversas;
   ```

## Monitoring

### Health Check Endpoint

For load balancers and monitoring:

```
GET https://your-app.osc-fr1.scalingo.io/health
```

Response:
```json
{
  "status": "ok",
  "waha": true,
  "mode": "webhook",
  "uptime": 3600
}
```

### Logs

View real-time logs:
```bash
scalingo -a your-app logs --stream
```

Filter by errors:
```bash
scalingo -a your-app logs | grep ERROR
```

### Metrics

View in Scalingo dashboard:
- CPU usage
- Memory usage
- Dyno uptime
- Restart count

## Rollback

If deployment fails:

### Option 1: Git Revert (Recommended)
```bash
git revert HEAD
git push scalingo main
```

### Option 2: Manual Restart
```bash
scalingo -a your-app restart
```

### Option 3: Scale Reset
```bash
# Clear memory
scalingo -a your-app scale web:512M
scalingo -a your-app scale web:2G
```

See `WAHA_PRODUCTION_SETUP.md` for detailed rollback procedures.

## Troubleshooting

### WAHA shows as disconnected
- Verify WAHA_URL and WAHA_API_KEY are correct
- Check WAHA server is running
- Verify firewall allows outbound HTTPS
- May need to re-authenticate WhatsApp session

### Messages not being received
- Check webhook URL configured in WAHA admin
- Verify webhook authentication
- Check firewall allows inbound POST requests

### Database connection timeout
- Verify PostgreSQL add-on provisioned
- Check SCALINGO_POSTGRESQL_URL is set
- Monitor connection pool usage

### High memory usage
- Check for memory leaks in code
- Scale to larger dyno if needed
- Review conversation history size

See `WAHA_PRODUCTION_SETUP.md` troubleshooting section for detailed solutions.

## Support

- **Documentation**: See `WAHA_PRODUCTION_SETUP.md`
- **Issues**: Check application logs with `scalingo logs --stream`
- **Scalingo Support**: https://support.scalingo.com/
- **WAHA Docs**: https://waha.devlike.ru/

## Useful Commands

```bash
# View environment variables
scalingo -a your-app env

# Set environment variable
scalingo -a your-app env-set KEY=value

# View app status
scalingo -a your-app ps

# View dyno metrics
scalingo -a your-app stats

# Restart app
scalingo -a your-app restart

# View database addons
scalingo -a your-app addons

# Get database tunnel
scalingo -a your-app db-tunnel SCALINGO_POSTGRESQL_URL

# View recent deployments
scalingo -a your-app deployments

# View logs
scalingo -a your-app logs --stream
scalingo -a your-app logs | head -100
```

## Best Practices

1. **Deploy During Low Traffic**
   - WAHA session resets on restart
   - Minimize impact on active users

2. **Monitor After Deploy**
   - Watch logs for first 10 minutes
   - Check health endpoint regularly
   - Verify message processing works

3. **Use Health Checks**
   - Configure load balancer health checks
   - Use `/health` endpoint
   - Monitor WAHA connectivity status

4. **Maintain Backups**
   - Regular database backups
   - Keep session state in MongoDB
   - Test restore procedures

5. **Document Changes**
   - Add deployment notes to git commits
   - Document configuration changes
   - Keep CHANGELOG updated

## Deployment Statistics

- **Average Deployment Time**: 5-10 minutes
- **Rollback Time**: 5 minutes
- **WAHA Reconnection Time**: 30-60 seconds
- **Database Migration Time**: Depends on data size

---

**Version**: 2.0 (WAHA Production Ready)
**Last Updated**: 2026-01-04
**Maintained By**: Sistema Jesus Cristo Team

For complete setup instructions, see `WAHA_PRODUCTION_SETUP.md`
