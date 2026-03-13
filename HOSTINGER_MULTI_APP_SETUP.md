# Hostinger VPS Multi-App Setup with Different URLs

This guide shows you how to host multiple apps on your Hostinger VPS, each with its own URL.

## 🎯 Goal

Host multiple apps on one VPS with different URLs:
- `http://187.124.87.237:3000` → IBM Recap
- `http://187.124.87.237:3001` → App 2
- `http://187.124.87.237:3002` → App 3

Or with subdomains (if you have a domain):
- `https://recap.yourdomain.com` → IBM Recap
- `https://app2.yourdomain.com` → App 2
- `https://app3.yourdomain.com` → App 3

---

## 📋 Three URL Options for Your VPS

### Option 1: Use Different Ports (Easiest, No Domain Needed)
**URLs:**
- `http://187.124.87.237:3000` → IBM Recap
- `http://187.124.87.237:3001` → App 2
- `http://187.124.87.237:3002` → App 3

**Pros:**
- ✅ No domain needed
- ✅ Quick setup (5 minutes per app)
- ✅ Free

**Cons:**
- ❌ Port numbers in URL (not professional)
- ❌ No HTTPS (unless you setup manually)

---

### Option 2: Use Subdomains (Professional, Requires Domain)
**URLs:**
- `https://recap.yourdomain.com` → IBM Recap
- `https://app2.yourdomain.com` → App 2
- `https://app3.yourdomain.com` → App 3

**Pros:**
- ✅ Professional URLs
- ✅ HTTPS with Let's Encrypt (free)
- ✅ No port numbers

**Cons:**
- ❌ Need to buy domain (~$10-15/year)
- ❌ Requires Nginx setup (root access)

---

### Option 3: Use Path-Based Routing (One Domain, Multiple Paths)
**URLs:**
- `https://yourdomain.com/recap` → IBM Recap
- `https://yourdomain.com/app2` → App 2
- `https://yourdomain.com/app3` → App 3

**Pros:**
- ✅ One domain for all apps
- ✅ HTTPS with Let's Encrypt
- ✅ Clean URLs

**Cons:**
- ❌ Need domain
- ❌ More complex Nginx config
- ❌ Apps need to handle base path

---

## 🚀 Option 1: Different Ports (Quick Setup)

### Current Setup:
- IBM Recap: Port 3000 ✅ (already running)

### Add More Apps:

#### App 2 on Port 3001:
```bash
# SSH to VPS
ssh asad@100.x.x.x

# Create directory for app 2
mkdir -p ~/app2
cd ~/app2

# Clone your app 2 repository
git clone https://github.com/yourusername/app2.git .

# Install dependencies
npm install

# Create .env with PORT=3001
nano .env
```

Add:
```env
PORT=3001
```

Start with PM2:
```bash
npx pm2 start server/index.js --name app2
npx pm2 save
```

#### App 3 on Port 3002:
```bash
mkdir -p ~/app3
cd ~/app3
git clone https://github.com/yourusername/app3.git .
npm install
nano .env  # Set PORT=3002
npx pm2 start server/index.js --name app3
npx pm2 save
```

### Open Firewall:
```bash
su -
ufw allow 3001/tcp
ufw allow 3002/tcp
ufw reload
exit
```

### Access Your Apps:
- IBM Recap: `http://187.124.87.237:3000`
- App 2: `http://187.124.87.237:3001`
- App 3: `http://187.124.87.237:3002`

**Done!** Each app has its own URL with different port.

---

## 🌐 Option 2: Subdomains (Professional Setup)

### Prerequisites:
- Domain name (e.g., `yourdomain.com`)
- Root access on VPS
- Nginx installed

### Step 1: Buy Domain
Buy from Namecheap, Google Domains, etc. (~$10-15/year)

### Step 2: Configure DNS

Add A records for each subdomain:

```
Type: A, Name: recap, Value: 187.124.87.237
Type: A, Name: app2, Value: 187.124.87.237
Type: A, Name: app3, Value: 187.124.87.237
```

### Step 3: Setup Apps on Different Ports

Same as Option 1:
- IBM Recap: Port 3000
- App 2: Port 3001
- App 3: Port 3002

### Step 4: Install Nginx

```bash
su -
apt update
apt install -y nginx
```

### Step 5: Configure Nginx for Each Subdomain

#### IBM Recap (recap.yourdomain.com):
```bash
nano /etc/nginx/sites-available/recap
```

Add:
```nginx
server {
    listen 80;
    server_name recap.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

#### App 2 (app2.yourdomain.com):
```bash
nano /etc/nginx/sites-available/app2
```

Add:
```nginx
server {
    listen 80;
    server_name app2.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### App 3 (app3.yourdomain.com):
```bash
nano /etc/nginx/sites-available/app3
```

Add:
```nginx
server {
    listen 80;
    server_name app3.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 6: Enable Sites

```bash
ln -s /etc/nginx/sites-available/recap /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/app2 /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/app3 /etc/nginx/sites-enabled/

# Remove default
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Reload
systemctl reload nginx
```

### Step 7: Add SSL Certificates

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificates for all subdomains
certbot --nginx -d recap.yourdomain.com
certbot --nginx -d app2.yourdomain.com
certbot --nginx -d app3.yourdomain.com

exit
```

### Step 8: Access Your Apps

- IBM Recap: `https://recap.yourdomain.com`
- App 2: `https://app2.yourdomain.com`
- App 3: `https://app3.yourdomain.com`

**Done!** Professional URLs with HTTPS! 🎊

---

## 📊 Port Management

### Current Port Allocation:
```
Port 3000: IBM Recap ✅
Port 3001: Available for App 2
Port 3002: Available for App 3
Port 3003: Available for App 4
Port 3004: Available for App 5
...
```

### Check What's Running:
```bash
# See all PM2 apps
npx pm2 list

# Check port usage
netstat -tulpn | grep LISTEN
```

### Add New App:
```bash
# Create directory
mkdir -p ~/new-app
cd ~/new-app

# Clone repo
git clone https://github.com/yourusername/new-app.git .

# Install
npm install

# Set unique port in .env
echo "PORT=3003" > .env

# Start with PM2
npx pm2 start server/index.js --name new-app
npx pm2 save

# Open firewall (if using ports directly)
su -
ufw allow 3003/tcp
ufw reload
exit
```

---

## 🔄 Managing Multiple Apps

### PM2 Commands:
```bash
# List all apps
npx pm2 list

# Restart specific app
npx pm2 restart ibm-recap
npx pm2 restart app2

# Stop specific app
npx pm2 stop app2

# Delete app
npx pm2 delete app2

# View logs for specific app
npx pm2 logs ibm-recap
npx pm2 logs app2

# Monitor all apps
npx pm2 monit
```

### Update App:
```bash
# Navigate to app directory
cd ~/ibm-recap

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart app
npx pm2 restart ibm-recap
```

---

## 💰 Cost Comparison

### Option 1: Different Ports
- **Cost:** FREE
- **URLs:** `http://187.124.87.237:3000`, `:3001`, `:3002`
- **Setup:** 5 minutes per app

### Option 2: Subdomains
- **Cost:** ~$10-15/year (domain only)
- **URLs:** `https://recap.yourdomain.com`, `app2.yourdomain.com`
- **Setup:** 30 minutes initial, 5 minutes per app

### Option 3: Path-Based
- **Cost:** ~$10-15/year (domain only)
- **URLs:** `https://yourdomain.com/recap`, `/app2`
- **Setup:** 45 minutes initial, 10 minutes per app

---

## 🎯 Recommended Approach

### For Quick Testing:
**Use Option 1 (Different Ports)**
- No domain needed
- Quick setup
- Free
- URLs: `http://187.124.87.237:3000`, `:3001`, etc.

### For Production/Professional:
**Use Option 2 (Subdomains)**
- Professional URLs
- HTTPS included
- Easy to manage
- URLs: `https://recap.yourdomain.com`, `app2.yourdomain.com`

---

## ✅ Quick Start Checklist

### For Each New App:

1. [ ] Create directory: `mkdir -p ~/app-name`
2. [ ] Clone repository: `git clone ...`
3. [ ] Install dependencies: `npm install`
4. [ ] Set unique port in `.env`: `PORT=300X`
5. [ ] Start with PM2: `npx pm2 start server/index.js --name app-name`
6. [ ] Save PM2: `npx pm2 save`
7. [ ] Open firewall (if needed): `ufw allow 300X/tcp`
8. [ ] Configure Nginx (if using subdomains)
9. [ ] Get SSL certificate (if using subdomains)
10. [ ] Test access

---

## 🔍 Example: Three Apps Setup

### Directory Structure:
```
/home/asad/
├── ibm-recap/          (Port 3000)
│   ├── server/
│   ├── public/
│   └── .env (PORT=3000)
├── app2/               (Port 3001)
│   ├── server/
│   └── .env (PORT=3001)
└── app3/               (Port 3002)
    ├── server/
    └── .env (PORT=3002)
```

### PM2 Status:
```
┌─────┬──────────────┬─────────┬─────────┬─────────┐
│ id  │ name         │ status  │ restart │ uptime  │
├─────┼──────────────┼─────────┼─────────┼─────────┤
│ 0   │ ibm-recap    │ online  │ 0       │ 2h      │
│ 1   │ app2         │ online  │ 0       │ 1h      │
│ 2   │ app3         │ online  │ 0       │ 30m     │
└─────┴──────────────┴─────────┴─────────┴─────────┘
```

### Access URLs:

**Without Domain (Option 1):**
- `http://187.124.87.237:3000` → IBM Recap
- `http://187.124.87.237:3001` → App 2
- `http://187.124.87.237:3002` → App 3

**With Domain (Option 2):**
- `https://recap.yourdomain.com` → IBM Recap
- `https://app2.yourdomain.com` → App 2
- `https://app3.yourdomain.com` → App 3

---

## 🆘 Troubleshooting

### Port Already in Use:
```bash
# Check what's using the port
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or use a different port
```

### App Not Starting:
```bash
# Check PM2 logs
npx pm2 logs app-name

# Check if port is set correctly
cat ~/app-name/.env

# Restart app
npx pm2 restart app-name
```

### Can't Access from Internet:
```bash
# Check firewall
sudo ufw status

# Open port
sudo ufw allow 3001/tcp
sudo ufw reload
```

### Nginx Not Working:
```bash
# Test config
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Summary

**You can host multiple apps on your Hostinger VPS with different URLs!**

### Quick Setup (No Domain):
- App 1: `http://187.124.87.237:3000`
- App 2: `http://187.124.87.237:3001`
- App 3: `http://187.124.87.237:3002`

**Setup:** 5 minutes per app, FREE

### Professional Setup (With Domain):
- App 1: `https://recap.yourdomain.com`
- App 2: `https://app2.yourdomain.com`
- App 3: `https://app3.yourdomain.com`

**Setup:** 30 minutes initial + domain cost (~$10-15/year)

**Your Hostinger VPS can host unlimited apps, each with its own URL! 🎊**