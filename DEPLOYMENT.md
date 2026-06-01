# 🚀 Moment U Payment Backend - Docker Deployment Guide

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Hosting Options](#hosting-options)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- Docker >= 20.10
- Docker Compose >= 1.29
- Git
- Node.js >= 18 (for local development only)

### Optional

- Nginx (if not using docker)
- PostgreSQL (if using external service)
- Redis (if using external service)

---

## Local Development

### 1. Setup Environment

```bash
cd backend

# Copy example env file
cp .env.example .env

# Edit .env with your local settings
nano .env
```

### 2. Start Services

```bash
# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### 3. Run Migrations

```bash
# First time setup
docker-compose exec backend npm run prisma:validate
docker-compose exec backend npm run migrate:deploy

# View database with Prisma Studio
docker-compose exec backend npm run prisma:studio
```

### 4. Access Services

- **Backend API**: http://localhost:8001
- **Swagger Docs**: http://localhost:8001/api
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379 (password: redis_password)

---

## Production Deployment

### Option A: Using Render.com (Recommended for beginners)

#### Step 1: Prepare Repository

```bash
# Ensure all files are committed
git add .
git commit -m "Add Docker configuration for deployment"
git push origin main
```

#### Step 2: Connect Repository to Render

1. Go to [render.com](https://render.com)
2. Create new account or login
3. Click "New" → "Web Service"
4. Select "Build and deploy from a Git repository"
5. Connect your GitHub repository

#### Step 3: Configure Web Service

```yaml
Name: moment-u-backend
Environment: Docker
Branch: main
Root Directory: backend

Build Command: (Leave empty - Docker handles it)
Start Command: (Leave empty - Docker handles it)

Environment Variables:
  DATABASE_URL: your_supabase_url
  DIRECT_URL: your_supabase_direct_url
  JWT_SECRET: (generate strong secret)
  REDIS_HOST: your_redis_host
  REDIS_PORT: 6379
  REDIS_PASSWORD: your_redis_password
  NODE_ENV: production
  # Add all other variables from .env.example
```

#### Step 4: Configure Services

1. **PostgreSQL**: Use Supabase (Free tier available)
   - Go to supabase.com → Create project
   - Copy DATABASE_URL and DIRECT_URL
   - Run migrations after deployment

2. **Redis**: Use Redis Cloud (Free tier available)
   - Go to redis.com → Create account
   - Create free Redis instance
   - Copy connection details

#### Step 5: Deploy

```bash
# First deployment
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate:deploy

# Verify health
curl https://your-service-name.onrender.com/health
```

---

### Option B: Using Railway.app

#### Step 1: Create Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project

#### Step 2: Add Services

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add PostgreSQL
railway add

# Add Redis
railway add

# Add Backend from Dockerfile
railway up
```

#### Step 3: Configure Environment

```bash
railway variables set DATABASE_URL="your_postgres_url"
railway variables set REDIS_HOST="your_redis_host"
railway variables set JWT_SECRET="your_secret"
# ... add all other variables
```

#### Step 4: Deploy

```bash
railway up --detach
```

---

### Option C: Using Docker on VPS (DigitalOcean, AWS EC2, etc.)

#### Step 1: Setup VPS

```bash
# SSH into VPS
ssh root@your_vps_ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### Step 2: Clone Repository

```bash
# Clone your repo
git clone https://github.com/your-username/moment-u-payment.git
cd moment-u-payment/backend

# Create .env from example
nano .env
# Edit with production values
```

#### Step 3: Setup SSL Certificate (Let's Encrypt)

```bash
# Create necessary directories
mkdir -p ssl www/certbot

# Generate self-signed cert (temporary)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem -out ssl/fullchain.pem

# Update nginx.conf with your domain
nano nginx.conf
```

#### Step 4: Start Services

```bash
# Pull latest code
git pull

# Build and start
docker-compose -f docker-compose.full-stack.yml build
docker-compose -f docker-compose.full-stack.yml up -d

# Run migrations
docker-compose -f docker-compose.full-stack.yml exec backend npm run migrate:deploy

# Verify
docker-compose -f docker-compose.full-stack.yml logs -f
```

#### Step 5: Setup Real SSL Certificate

```bash
# Using Certbot
docker-compose -f docker-compose.full-stack.yml --profile ssl run --rm certbot \
  certonly --webroot --webroot-path /var/www/certbot \
  -d yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos --no-eff-email
```

#### Step 6: Setup Firewall

```bash
# Allow HTTP, HTTPS, SSH
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

#### Step 7: Setup Auto-renewal Cron

```bash
# Edit crontab
crontab -e

# Add this line (renewal every 2 months):
0 2 1 */2 * docker-compose -f /path/to/docker-compose.full-stack.yml run certbot renew --quiet

# Or use systemd timer
sudo systemctl enable docker-compose-renew.timer
```

---

## Hosting Options

| Provider         | Pros                      | Cons                          | Cost              |
| ---------------- | ------------------------- | ----------------------------- | ----------------- |
| **Render.com**   | Easy setup, Docker-native | Limited customization         | Free tier → $7/mo |
| **Railway.app**  | Simple, good UX           | Limited features              | Free tier → $5/mo |
| **DigitalOcean** | Full control, reliable    | Requires manual setup         | $6/mo             |
| **AWS**          | Scalable, powerful        | Complex, expensive            | Variable          |
| **Heroku**       | Easy deployment           | Expensive, being discontinued | $50/mo minimum    |

---

## Database Services

| Provider          | Type       | Pros                     | Cost               |
| ----------------- | ---------- | ------------------------ | ------------------ |
| **Supabase**      | PostgreSQL | Free tier generous, easy | Free → $25/mo      |
| **PlanetScale**   | MySQL      | Free tier large          | Free tier → $29/mo |
| **MongoDB Atlas** | NoSQL      | Generous free tier       | Free tier → $57/mo |

---

## Cache Services

| Provider            | Type            | Pros                    | Cost            |
| ------------------- | --------------- | ----------------------- | --------------- |
| **Redis Cloud**     | Redis           | Free tier 30MB          | Free → $2.40/mo |
| **Upstash**         | Redis           | Serverless, pay-per-use | Free → $0.50+   |
| **AWS ElastiCache** | Redis/Memcached | Enterprise              | Variable        |

---

## Monitoring & Logging

### Setup Logging

```bash
# View logs
docker-compose logs -f backend

# Save logs to file
docker-compose logs backend > backend.log

# With timestamps and last 100 lines
docker-compose logs -f --timestamps backend | tail -100
```

### Health Monitoring

```bash
# Check backend health
curl -s https://your-domain.com/health | jq

# Check all services
docker-compose ps

# Check resource usage
docker stats
```

### Setup Monitoring Service

```yaml
# Option: Use Sentry for error tracking
# 1. Create account at sentry.io
# 2. Add to .env: SENTRY_DSN=your_dsn
# 3. See NestJS integration docs
```

---

## Troubleshooting

### 1. Container won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Port already in use: kill process on port 8001
# - Database connection failed: check DATABASE_URL
# - Out of memory: increase Docker resources
```

### 2. Database migration fails

```bash
# Check Prisma client
docker-compose exec backend npm install @prisma/client

# Validate schema
docker-compose exec backend npm run prisma:validate

# Reset database (DANGER!)
docker-compose exec backend npx prisma migrate reset
```

### 3. Redis connection fails

```bash
# Test Redis connection
docker-compose exec backend redis-cli -h redis -p 6379 -a redis_password ping

# If external Redis, check credentials and network
```

### 4. SSL certificate issues

```bash
# Check certificate expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Renew manually
docker-compose -f docker-compose.full-stack.yml run --rm certbot renew --force-renewal
```

### 5. High memory usage

```bash
# Check resource limits
docker stats

# Increase memory in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G

# Then restart
docker-compose restart backend
```

---

## Security Checklist

- ✅ Change JWT_SECRET to strong random value
- ✅ Use HTTPS only (SSL certificate)
- ✅ Hide .env file (add to .gitignore)
- ✅ Regular backups of database
- ✅ Monitor error logs for suspicious activity
- ✅ Keep Docker images updated
- ✅ Use firewall to restrict access
- ✅ Enable authentication on Redis
- ✅ Set strong database passwords
- ✅ Rotate secrets regularly

---

## Useful Commands

```bash
# View all containers
docker ps -a

# Stop all services
docker-compose down

# Remove everything including data
docker-compose down -v

# Update and restart
git pull && docker-compose build && docker-compose up -d

# Execute command in container
docker-compose exec backend npm run migrate:deploy

# View live logs
docker-compose logs -f --tail=100 backend

# Backup database
docker-compose exec postgres pg_dump -U postgres moment_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres moment_db < backup.sql
```

---

## Performance Optimization

### 1. Image Optimization

```bash
# Current image size can be reduced by:
# - Using .dockerignore
# - Multi-stage builds (already done)
# - Removing dev dependencies in production

# Check image size
docker images | grep moment_u_backend
```

### 2. Database Optimization

```bash
# Create indexes for frequently queried fields
# In Prisma schema:
@@index([userId])
@@index([spentAt])

# Then run migration:
npx prisma migrate dev --name add_indexes
```

### 3. Redis Caching

```bash
# Enable caching in NestJS
# Cache HTTP responses
# Cache database queries
# See NestJS docs for @Cacheable()
```

---

## Backup & Disaster Recovery

### Daily Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backups/moment-u"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Backup database
docker-compose exec -T postgres pg_dump -U postgres moment_db | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Backup Redis
docker-compose exec -T redis redis-cli --rdb > "$BACKUP_DIR/redis_$DATE.rdb"

# Upload to S3
aws s3 cp "$BACKUP_DIR/db_$DATE.sql.gz" s3://your-bucket/backups/

# Keep only last 30 days
find "$BACKUP_DIR" -mtime +30 -delete
```

---

## Support & Resources

- [Docker Documentation](https://docs.docker.com)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Nginx Documentation](https://nginx.org/en/docs)
- [Let's Encrypt](https://letsencrypt.org)

---

**Last Updated**: June 2026
**Version**: 1.0.0
