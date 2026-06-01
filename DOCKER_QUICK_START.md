# 🐳 Quick Start - Docker Deployment

## 🚀 Local Development (5 minutes)

### 1. Clone & Navigate

```bash
cd backend
cp .env.example .env
```

### 2. Start Everything

```bash
docker-compose up -d
```

### 3. Run Migrations

```bash
docker-compose exec backend npm run migrate:deploy
```

### 4. Access Services

- **API**: http://localhost:8001
- **Docs**: http://localhost:8001/api
- **Database**: localhost:5432

### 5. View Logs

```bash
docker-compose logs -f backend
```

---

## 🌍 Production Deployment (Choose One)

### Option 1: Render.com (Recommended - Free tier available)

```bash
# 1. Push code to GitHub
git push origin main

# 2. Go to render.com
# 3. Create new Web Service
# 4. Connect your GitHub repo
# 5. Set environment variables from .env.example
# 6. Deploy!
```

**Resources needed:**

- Supabase (Free) for PostgreSQL
- Redis Cloud (Free) for Redis

### Option 2: Railway.app

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login & init project
railway login
railway init

# 3. Add services
railway add  # Select PostgreSQL
railway add  # Select Redis

# 4. Deploy
railway up
```

### Option 3: VPS (DigitalOcean, Linode, etc.)

```bash
# 1. SSH to VPS
ssh root@your_vps_ip

# 2. Clone repo & run setup
git clone https://github.com/your-username/moment-u-payment.git
cd moment-u-payment/backend

# 3. Auto setup (as root)
sudo bash setup-docker.sh prod

# 4. Edit .env with production values
nano .env

# 5. Setup SSL
docker-compose -f docker-compose.full-stack.yml --profile ssl run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  -d yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos --no-eff-email

# 6. Restart with SSL
docker-compose -f docker-compose.full-stack.yml restart nginx
```

---

## 📋 Useful Commands

### View Logs

```bash
docker-compose logs -f backend
```

### Run Database Migrations

```bash
docker-compose exec backend npm run migrate:deploy
```

### Access Database

```bash
docker-compose exec postgres psql -U postgres moment_db
```

### Access Redis

```bash
docker-compose exec redis redis-cli -a redis_password
```

### Stop Everything

```bash
docker-compose down
```

### Remove Everything (including data)

```bash
docker-compose down -v
```

### Rebuild & Restart

```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔒 Security Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Set REDIS_PASSWORD
- [ ] Use HTTPS in production
- [ ] Hide .env file
- [ ] Setup firewall on VPS
- [ ] Regular database backups
- [ ] Monitor error logs

---

## 📊 Environment Comparison

| Feature    | Local Dev | Render  | Railway | VPS    |
| ---------- | --------- | ------- | ------- | ------ |
| Setup Time | 5 min     | 10 min  | 10 min  | 30 min |
| Cost       | Free      | Free-$7 | Free-$5 | $6+    |
| Control    | Full      | Limited | Limited | Full   |
| SSL        | No        | Yes     | Yes     | Manual |
| Backups    | Manual    | Auto    | Auto    | Manual |
| Support    | Community | Good    | Good    | None   |

---

## 🐛 Troubleshooting

### Port 8001 already in use

```bash
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9

# Or change port in .env and docker-compose.yml
```

### Database connection failed

```bash
# Check DATABASE_URL in .env
# Make sure PostgreSQL container is running
docker-compose logs postgres
```

### Out of memory

```bash
# Increase Docker resources in Docker Desktop settings
# Or add memory limits in docker-compose.yml
```

### Container keeps restarting

```bash
# Check logs for errors
docker-compose logs --tail=50 backend
```

---

## 📞 Support

- See full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Docker docs: https://docs.docker.com
- NestJS docs: https://docs.nestjs.com
- Render docs: https://render.com/docs

---

**Ready?** Start with: `docker-compose up -d` 🚀
