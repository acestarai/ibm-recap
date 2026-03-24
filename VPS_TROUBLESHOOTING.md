# VPS 502 Bad Gateway - Troubleshooting Guide

## 🔴 Current Issue

**Error**: 502 Bad Gateway  
**Cause**: The app deployed but isn't running properly on the VPS  
**GitHub Actions**: Deploy succeeded, but app failed to start

---

## 🔧 Quick Fix Steps

### Step 1: SSH into Your VPS

```bash
ssh your-username@your-vps-ip
```

### Step 2: Check PM2 Status

```bash
pm2 status
pm2 logs ibm-recap --lines 50
```

Look for error messages in the logs.

### Step 3: Common Issues & Fixes

#### Issue A: Missing Environment Variables

**Check if .env exists:**
```bash
cd /var/www/ibm-recap
ls -la .env
```

**If missing, create it:**
```bash
nano .env
```

Add your environment variables:
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_key
ASSEMBLYAI_API_KEY=your_assemblyai_key
```

Save and exit (Ctrl+X, Y, Enter)

#### Issue B: Node Modules Not Installed

```bash
cd /var/www/ibm-recap
npm install
```

#### Issue C: App Not Starting

```bash
pm2 restart ibm-recap
pm2 logs ibm-recap
```

#### Issue D: Port Already in Use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill the process if needed
sudo kill -9 <PID>

# Restart app
pm2 restart ibm-recap
```

### Step 4: Manual Restart

```bash
cd /var/www/ibm-recap
pm2 stop ibm-recap
pm2 delete ibm-recap
pm2 start server/index.js --name ibm-recap
pm2 save
```

### Step 5: Check Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

---

## 🔍 Detailed Diagnostics

### Check App Logs
```bash
pm2 logs ibm-recap --lines 100
```

### Check System Resources
```bash
free -h
df -h
```

### Check Node Version
```bash
node --version  # Should be v18.x or higher
```

### Test App Manually
```bash
cd /var/www/ibm-recap
node server/index.js
```

If you see errors, they'll show up here.

---

## 🚨 Most Likely Causes

1. **Missing .env file** (most common)
2. **Missing Supabase credentials**
3. **Node modules not installed**
4. **Port conflict**
5. **Syntax error in code**

---

## 📝 Quick Recovery Commands

Run these in order:

```bash
# 1. Go to app directory
cd /var/www/ibm-recap

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
npm install

# 4. Check if .env exists
cat .env

# 5. Restart app
pm2 restart ibm-recap

# 6. Check logs
pm2 logs ibm-recap --lines 20

# 7. Check status
pm2 status

# 8. Restart Nginx
sudo systemctl restart nginx
```

---

## ✅ Success Indicators

When fixed, you should see:

```bash
pm2 status
# Should show: ibm-recap | online | 0 | ...

pm2 logs ibm-recap
# Should show: TeamsCallSummarizer running at http://localhost:3000
```

---

## 🆘 If Still Not Working

### Option 1: Run Locally for Presentation
```bash
# On your local machine
npm start
# Present from http://localhost:8787
```

### Option 2: Check GitHub Actions Logs
1. Go to https://github.com/acestarai/ibm-recap/actions
2. Click on the failed workflow
3. Check the error messages
4. Share them with me for help

---

## 📞 Need Help?

Share the output of these commands:
```bash
pm2 logs ibm-recap --lines 50
pm2 status
cat /var/www/ibm-recap/.env | head -5  # First 5 lines only