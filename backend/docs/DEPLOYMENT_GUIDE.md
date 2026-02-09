# manageRTC HRM Module - Deployment Guide

This guide covers deploying the manageRTC HRM application, which consists of a Node.js/Express backend, React frontend, and MongoDB database.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Production Checklist](#production-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Component | Version | Description |
|-----------|---------|-------------|
| Node.js | ≥18.x | JavaScript runtime |
| npm | ≥9.x | Package manager |
| MongoDB | ≥6.0 | Database (Atlas or self-hosted) |
| Git | ≥2.x | Version control |

### Infrastructure

- **Server**: Linux (Ubuntu 22.04 LTS recommended) with at least:
  - 2 GB RAM (4 GB recommended)
  - 20 GB disk space
  - 1 CPU core (2 cores recommended)

- **Database**: MongoDB Atlas (recommended) or self-hosted MongoDB replica set

- **Reverse Proxy**: Nginx or Caddy

---

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Node Environment
NODE_ENV=production

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.example.net/ProductionDB
MONGODB_DATABASE=AmasQIS_Production

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_JWT_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# JWT Secret (for additional token verification)
JWT_SECRET=your-secret-key-min-32-characters-long

# Server Configuration
PORT=5000
DOMAIN=api.yourdomain.com

# CORS Configuration
FRONTEND_URL=https://yourdomain.com

# Socket.IO Configuration
SOCKET_CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info

# Email (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Frontend Environment Variables

Create a `.env.production` file in the `react/` directory:

```bash
# API Configuration
VITE_API_URL=https://api.yourdomain.com/api
VITE_WS_URL=wss://api.yourdomain.com

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Application Settings
VITE_APP_NAME=manageRTC
VITE_APP_URL=https://yourdomain.com

# Feature Flags
VITE_ENABLE_ANALYTICS=true
```

---

## Database Setup

### Option 1: MongoDB Atlas (Recommended)

1. **Create a Cluster**
   - Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster (M0+ for production)
   - Select a region closest to your application server

2. **Configure Security**
   - Create a database user with `readWrite` permissions
   - Whitelist your server IP addresses (or use 0.0.0.0/0 for all)
   - Enable SCRAM authentication

3. **Get Connection String**
   ```
   mongodb+srv://username:password@cluster.xxxxx.mongodb.net/ProductionDB
   ```

4. **Initial Setup**
   - The application will create collections automatically
   - For manual setup, see `backend/migrations/` folder

### Option 2: Self-Hosted MongoDB

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   ```

2. **Configure Replica Set** (required for transactions)
   ```bash
   # Edit /etc/mongod.conf
   replication:
     replSetName: "rs0"
   ```

3. **Start MongoDB**
   ```bash
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

4. **Initialize Replica Set**
   ```bash
   mongosh --eval "rs.initiate()"
   ```

---

## Backend Deployment

### 1. Install Dependencies

```bash
cd backend
npm ci --production
```

### 2. Build Application

```bash
# No build step needed for Node.js backend
# But you can verify dependencies
npm list --depth=0
```

### 3. Run Database Migrations (if any)

```bash
# Run migrations to set up indexes and initial data
node migrations/addCompanyUserCount.js
node migrations/addPersonalInfoFields.js
```

### 4. Using PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start server.js --name "managertc-backend"

# Configure PM2 for auto-restart on server reboot
pm2 startup
pm2 save

# View logs
pm2 logs managertc-backend

# Monitor
pm2 monit
```

### 5. Create PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'managertc-backend',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
```

### 6. Nginx Reverse Proxy Configuration

```nginx
# /etc/nginx/sites-available/managertc-api
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Routes
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json application/javascript text/css text/javascript;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/managertc-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Frontend Deployment

### 1. Build the React Application

```bash
cd react
npm ci
npm run build
```

### 2. Serve with Nginx

Create `/etc/nginx/sites-available/managertc-frontend`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    root /var/www/managertc/build;
    index index.html;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # SPA Routing - All requests go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Asset Caching
    location ~* \.(?:jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Static JS/CSS Caching
    location ~* \.(?:js|css)$ {
        expires 1M;
        add_header Cache-Control "public";
    }
}
```

### 3. Deploy Build Files

```bash
# Create directory
sudo mkdir -p /var/www/managertc

# Copy build files
sudo cp -r build/* /var/www/managertc/

# Set permissions
sudo chown -R www-data:www-data /var/www/managertc
sudo chmod -R 755 /var/www/managertc
```

### 4. Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/managertc-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Production Checklist

### Security

- [ ] Use strong MongoDB passwords
- [ ] Enable MongoDB IP whitelisting
- [ ] Use HTTPS for all endpoints (SSL certificates)
- [ ] Set secure CORS origins
- [ ] Enable rate limiting on API endpoints
- [ ] Set up firewall rules (ufw)
- [ ] Disable server-side debugging
- [ ] Use environment variables for secrets
- [ ] Rotate secrets periodically
- [ ] Enable MongoDB authentication

### Performance

- [ ] Enable MongoDB indexing on critical fields
- [ ] Configure Nginx caching
- [ ] Enable gzip compression
- [ ] Use PM2 cluster mode for multi-core servers
- [ ] Set up CDN for static assets (optional)
- [ ] Configure MongoDB connection pooling
- [ ] Enable Socket.IO sticky sessions (if using load balancer)

### Monitoring

- [ ] Set up application logging (Winston)
- [ ] Configure log rotation
- [ ] Set up error tracking (Sentry or similar)
- [ ] Monitor server resources (CPU, memory, disk)
- [ ] Set up uptime monitoring
- [ ] Configure database backups

### Backup

- [ ] Set up automated MongoDB backups
- [ ] Test backup restoration procedure
- [ ] Backup environment configurations
- [ ] Document recovery procedures

---

## Monitoring & Maintenance

### Log Management

Logs are stored in `backend/logs/`:
- `error-YYYY-MM-DD.log` - Error logs
- `combined-YYYY-MM-DD.log` - All logs
- `http-YYYY-MM-DD.log` - HTTP request logs
- `exceptions-YYYY-MM-DD.log` - Uncaught exceptions

View logs:
```bash
pm2 logs managertc-backend --lines 100
```

### Database Maintenance

```bash
# Connect to MongoDB
mongosh mongodb://your-connection-string

# Check collection stats
db.stats()

# Rebuild indexes
db.employees.reIndex()

# Compact database (run during maintenance window)
db.runCommand({compact: 'employees'})
```

### Health Checks

Create a health check endpoint or use:
```bash
curl https://api.yourdomain.com/api/health
```

---

## Troubleshooting

### Issue: MongoDB Connection Timeout

**Symptoms**: `MongoServerSelectionError: connect ETIMEDOUT`

**Solutions**:
1. Check MongoDB Atlas IP whitelist
2. Verify connection string format
3. Check network connectivity
4. Ensure MongoDB cluster is running

### Issue: Socket.IO Not Connecting

**Symptoms**: WebSocket connection failures

**Solutions**:
1. Check Nginx WebSocket configuration
2. Verify CORS settings
3. Ensure sticky sessions are configured on load balancer
4. Check firewall rules for WebSocket port

### Issue: PM2 App Keeps Restarting

**Symptoms**: App status shows "errored" and constantly restarts

**Solutions**:
```bash
# Check logs
pm2 logs managertc-backend --lines 50

# Check for memory issues
pm2 monit

# Reset restart count
pm2 reset managertc-backend

# Restart with clean slate
pm2 delete managertc-backend
pm2 start ecosystem.config.js
```

### Issue: High Memory Usage

**Solutions**:
1. Check for memory leaks in application code
2. Adjust PM2 `max_memory_restart` setting
3. Review MongoDB query performance
4. Enable garbage collection logging

### Issue: Slow API Response

**Solutions**:
1. Check MongoDB index usage with `.explain()`
2. Enable response caching where appropriate
3. Review Nginx access logs for slow requests
4. Consider database sharding for high traffic

---

## Rollback Procedure

If deployment fails:

1. **Backend Rollback**
   ```bash
   pm2 stop managertc-backend
   git checkout previous-version
   npm ci --production
   pm2 restart managertc-backend
   ```

2. **Frontend Rollback**
   ```bash
   cd react
   git checkout previous-version
   npm ci
   npm run build
   sudo cp -r build/* /var/www/managertc/
   ```

3. **Database Rollback**
   - Restore from automated backup
   - Or use MongoDB point-in-time recovery

---

## Support

For issues and questions:
- GitHub Issues: [manageRTC/issues](https://github.com/your-repo/issues)
- Documentation: [Full Docs](./README.md)
- Email: support@managertc.com
