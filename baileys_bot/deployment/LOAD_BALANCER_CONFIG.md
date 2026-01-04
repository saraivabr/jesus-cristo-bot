# Load Balancer Configuration

Configuration examples for common load balancers with Jesus Cristo Bot.

## Health Check Endpoint

All load balancers should monitor this endpoint:

```
GET /health HTTP/1.1
Host: your-app.osc-fr1.scalingo.io
```

**Expected Response**:
```json
{
  "status": "ok",
  "waha": true,
  "mode": "webhook",
  "uptime": 3600
}
```

**HTTP Status**: 200 OK

**Recommended Configuration**:
- **Interval**: 30 seconds
- **Timeout**: 5 seconds
- **Healthy Threshold**: 2 consecutive successes
- **Unhealthy Threshold**: 3 consecutive failures

---

## Scalingo Native Load Balancer

Scalingo provides built-in load balancing for your application dyno.

### Configuration

No special configuration needed. Scalingo automatically:
- Monitors dyno health
- Restarts failed dyno
- Routes traffic to healthy instance
- Scales to multiple dynos if needed

### Scaling to Multiple Dynos

```bash
scalingo -a your-app scale web:2G --num=2
```

This creates 2 dynos, both receiving traffic.

### Monitoring

View in Scalingo Dashboard:
1. Go to your app
2. Click "Overview"
3. Check dyno status and restart count
4. Monitor metrics in "Analytics" tab

---

## AWS Application Load Balancer (ALB)

Configuration for AWS ALB with Scalingo backend.

### Health Check Configuration

```
Protocol:               HTTP
Port:                   443
Path:                   /health
Matcher:                200
Interval:               30 seconds
Timeout:                5 seconds
Healthy threshold:      2
Unhealthy threshold:    3
```

### CloudFormation Template

```yaml
HealthCheckConfiguration:
  HealthyThresholdCount: 2
  UnhealthyThresholdCount: 3
  TimeoutSeconds: 5
  IntervalSeconds: 30
  Path: /health
  Port: '443'
  Protocol: HTTPS
  Matcher:
    HttpCode: '200'
```

### Terraform Configuration

```hcl
resource "aws_lb_target_group" "jesus_bot" {
  name             = "jesus-bot-tg"
  port             = 443
  protocol         = "HTTPS"
  target_type      = "instance"
  vpc_id           = aws_vpc.main.id

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }
}

resource "aws_lb_target_group_attachment" "jesus_bot" {
  target_group_arn = aws_lb_target_group.jesus_bot.arn
  target_id        = aws_instance.scalingo.id
  port             = 443
}
```

---

## Google Cloud Load Balancer

Configuration for Google Cloud Platform.

### Health Check Configuration

```
Protocol:               HTTPS
Port:                   443
Request Path:           /health
Check Interval:         30 seconds
Timeout:                5 seconds
Healthy Threshold:      2
Unhealthy Threshold:    3
```

### gcloud CLI

```bash
gcloud compute health-checks create https jesus-bot-health \
  --port=443 \
  --request-path=/health \
  --check-interval=30s \
  --timeout=5s \
  --healthy-threshold=2 \
  --unhealthy-threshold=3
```

### Cloud Architecture

```
                    Google Cloud LB
                          |
                          v
        ┌─────────────────────────────────┐
        │   Scalingo App (jesus-bot-prod) │
        │   ┌───────────────────────────┐ │
        │   │  Express Web Server       │ │
        │   │  Port: 8080 -> :443       │ │
        │   │  /health endpoint         │ │
        │   │                           │ │
        │   │  WAHA Webhooks:           │ │
        │   │  POST /webhook/messages   │ │
        │   │  POST /webhook/health     │ │
        │   └───────────────────────────┘ │
        │                                 │
        │   PostgreSQL (add-on)           │
        │   MongoDB (add-on)              │
        │   Redis (add-on)                │
        └─────────────────────────────────┘
```

---

## Azure Load Balancer

Configuration for Microsoft Azure.

### Health Probe Configuration

```
Protocol:           HTTPS
Port:               443
Request Path:       /health
Interval (sec):     30
Unhealthy Thr.:     3
Number of probes:   2
```

### PowerShell Configuration

```powershell
$healthProbe = New-AzLoadBalancerProbeConfig `
  -Name "jesus-bot-health" `
  -Protocol "Https" `
  -Port 443 `
  -RequestPath "/health" `
  -IntervalInSeconds 30 `
  -ProbeCount 2

Add-AzLoadBalancerProbeConfig `
  -LoadBalancer $lb `
  -HealthProbe $healthProbe
```

---

## Cloudflare

Configuration for Cloudflare reverse proxy/CDN.

### Origin Health Check

Cloudflare doesn't directly health-check origins, but can use automatic failover:

1. Go to **Loadbalancing** in Cloudflare dashboard
2. Create a **Load Balancer** pool
3. Add origin: `your-app.osc-fr1.scalingo.io`
4. Enable **Host Header Override**: `your-app.osc-fr1.scalingo.io`
5. Check **Monitor Origins**: ✓
6. Create a health check:
   - **Type**: HTTPS
   - **Port**: 443
   - **Path**: `/health`
   - **Interval**: 30 seconds
   - **Timeout**: 5 seconds
   - **Retries**: 2

### WAF Rule (Optional)

Protect webhook endpoint from abuse:

```
(cf.request_uri contains "/webhook" and cf.request_method != "POST") or
(cf.threat_score > 50 and cf.request_uri contains "/webhook")
```

Action: Challenge or Block

---

## NGINX Reverse Proxy

Configuration if you're running NGINX in front of Scalingo.

### upstream Configuration

```nginx
upstream jesus_bot {
    server your-app.osc-fr1.scalingo.io:443;
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    location /health {
        access_log off;
        proxy_pass https://jesus_bot;
        proxy_set_header Host your-app.osc-fr1.scalingo.io;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    location /webhook/messages {
        proxy_pass https://jesus_bot;
        proxy_set_header Host your-app.osc-fr1.scalingo.io;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }

    location / {
        proxy_pass https://jesus_bot;
        proxy_set_header Host your-app.osc-fr1.scalingo.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Health Check with NGINX

```nginx
# Separate upstream for health checks
upstream health_check {
    server your-app.osc-fr1.scalingo.io:443;
}

map $uri $skip_log {
    "/health" 1;
    default 0;
}

server {
    access_log /var/log/nginx/access.log combined if=$skip_log;

    # Health check location (low logging noise)
    location /health {
        access_log off;
        proxy_pass https://health_check;
        proxy_set_header Host your-app.osc-fr1.scalingo.io;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

---

## HAProxy

Configuration for HAProxy load balancer.

### Basic Configuration

```
global
    timeout connect 5000
    timeout client 50000
    timeout server 50000

defaults
    mode http
    timeout connect 5s
    timeout client 50s
    timeout server 50s

frontend web_front
    bind *:80
    default_backend jesus_bot_backend

backend jesus_bot_backend
    balance roundrobin
    server scalingo your-app.osc-fr1.scalingo.io:443 check ssl verify none \
        inter 30s fall 3 rise 2

    # Disable logging for health checks
    option dontlog-normal

    # Health check details
    option httpchk GET /health HTTP/1.1
    http-check expect status 200
```

### Production Configuration

```haproxy
global
    maxconn 4000
    daemon
    log 127.0.0.1 local0
    log 127.0.0.1 local1 notice

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5000
    timeout client  50000
    timeout server  50000

frontend jesus_bot_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/your-cert.pem
    redirect scheme https code 301 if !{ ssl_fc }
    default_backend jesus_bot_backend

backend jesus_bot_backend
    mode http
    balance roundrobin

    option httpchk GET /health HTTP/1.1
    option httpchk GET /health
    http-check expect status 200

    server scalingo-1 your-app.osc-fr1.scalingo.io:443 \
        ssl verify none \
        check \
        inter 30s \
        fall 3 \
        rise 2 \
        weight 100
```

---

## Monitoring & Alerts

### CloudWatch (AWS)

```python
import boto3

cloudwatch = boto3.client('cloudwatch')

cloudwatch.put_metric_alarm(
    AlarmName='JesusBot-HealthCheck-Failed',
    MetricName='TargetGroup_HealthyHostCount',
    Namespace='AWS/ApplicationELB',
    Statistic='Average',
    Period=60,
    EvaluationPeriods=1,
    Threshold=1,
    ComparisonOperator='LessThanThreshold',
    AlarmActions=['arn:aws:sns:region:account:topic-name']
)
```

### Datadog Monitors

```python
from datadog import api

api.Monitor.create(
    type='http_check',
    name='Jesus Bot Health Check',
    query='http_check.status{url:https://your-app.osc-fr1.scalingo.io/health}.last(5m)',
    thresholds={
        'critical': 1
    },
    options={
        'timeout': 10,
        'include_tags': True,
        'locked': False
    },
    tags=['service:jesus-bot', 'env:production']
)
```

---

## Failover Strategy

### Multi-Region Setup

For high availability, deploy to multiple Scalingo regions:

```
Region 1: EU (osc-fr1) - Primary
Region 2: US (us-east-1) - Failover

Load Balancer Routes:
- Health check both regions
- Route to EU first
- Automatic failover to US if EU unhealthy
```

### Configuration Example (Cloudflare)

1. Create 2 load balancer pools:
   - Pool 1: EU region (priority 10)
   - Pool 2: US region (priority 5)

2. Health checks monitor both:
   ```
   https://your-app-eu.osc-fr1.scalingo.io/health
   https://your-app-us.up.railway.app/health
   ```

3. Failover happens automatically if primary unhealthy

---

## Recommendations

1. **Health Check Tuning**
   - Keep interval at 30 seconds
   - Set timeout to 5 seconds
   - Use healthy/unhealthy thresholds of 2-3

2. **Logging**
   - Disable logging for `/health` endpoint
   - Creates too much noise
   - Monitor failures only via alerts

3. **Certificate Management**
   - Use Let's Encrypt for production
   - Auto-renew certificates
   - Cloudflare or AWS Certificate Manager recommended

4. **Rate Limiting**
   - Protect `/webhook/messages` from abuse
   - Set reasonable rate limits (10 req/sec)
   - Monitor for DDoS patterns

5. **SSL/TLS**
   - Require HTTPS for all endpoints
   - Use TLS 1.2 minimum
   - Enable HSTS headers

---

**Last Updated**: 2026-01-04
**Version**: 2.0
**Tested With**: Scalingo, AWS ALB, Google Cloud LB, Cloudflare
