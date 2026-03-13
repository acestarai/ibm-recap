# Quick Deploy Guide - Node.js Already Installed!

Great news! Your VPS already has Node.js v25.8.0 and npm 11.11.0 installed. You can skip the Node.js installation and proceed directly with deployment.

## ✅ Prerequisites Met

- ✅ Node.js v25.8.0 (even better than v18!)
- ✅ npm 11.11.0
- ✅ Connected via Tailscale
- ✅ Logged in as user `asad`

---

## 🚀 Quick Deployment Steps

### Step 1: Install FFmpeg (Required for Audio Processing)

Check if FFmpeg is already installed:
```bash
ffmpeg -version
```

If not installed, you'll need root access. Try:
```bash
su -
# Enter root password, then:
apt update
apt install -y ffmpeg
exit
```

If you don't have root access, ask Hostinger support to install FFmpeg.

---

### Step 2: Install PM2 (Process Manager)

```bash
# Install PM2 globally (no sudo needed if npm is set up correctly)
npm install -g pm2

# If that fails due to permissions, install locally:
npm install pm2

# Verify installation
pm2 --version
# Or if installed locally:
npx pm2 --version
```

---

### Step 3: Create Application Directory

```bash
# Create directory for your app
mkdir -p ~/ibm-recap
cd ~/ibm-recap
```

---

### Step 4: Clone Your Repository

```bash
# Clone from GitHub
git clone https://github.com/acestarai/ibm-recap.git .

# Verify files
ls -la
```

---

### Step 5: Install Dependencies

```bash
# Install npm packages
npm install
```

---

### Step 6: Create Environment File

```bash
# Create .env file
nano .env
```

Add your environment variables (optional):
```env
PORT=3000
OPENAI_API_KEY=your_openai_key_here
WATSON_API_KEY=your_watson_key_here
WATSON_PROJECT_ID=your_project_id_here
```

Save and exit (Ctrl+X, then Y, then Enter)

---

### Step 7: Start Application with PM2

If PM2 is installed globally:
```bash
pm2 start server/index.js --name ibm-recap
pm2 save
pm2 list
```

If PM2 is installed locally:
```bash
npx pm2 start server/index.js --name ibm-recap
npx pm2 save
npx pm2 list
```

---

### Step 8: Test Your Application

```bash
# Check if app is running
curl http://localhost:3000

# Or check PM2 logs
pm2 logs ibm-recap
# Or: npx pm2 logs ibm-recap
```

---

## 🌐 Access Your Application

### Option A: Direct Access (Port 3000)

If your firewall allows it:
```
http://100.x.x.x:3000
```

### Option B: Setup Nginx Reverse Proxy (Recommended)

This requires root access. If you have it:

```bash
su -
# Enter root password

# Install Nginx
apt update
apt install -y nginx

# Create Nginx config
nano /etc/nginx/sites-available/ibm-recap
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name _;

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

Enable the site:
```bash
ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
exit
```

Then access via:
```
http://100.x.x.x
```

---

## 🔄 Setup CI/CD with Self-Hosted Runner

### Step 1: Install GitHub Actions Runner

```bash
# Create directory for runner
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download latest runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
```

### Step 2: Configure Runner

1. Go to: https://github.com/acestarai/ibm-recap/settings/actions/runners/new
2. Select **Linux** and **x64**
3. Copy the configuration command (includes token)
4. Run it on your VPS:

```bash
./config.sh --url https://github.com/acestarai/ibm-recap --token YOUR_TOKEN_HERE

# When prompted:
# - Runner name: hostinger-vps
# - Runner group: Default
# - Labels: self-hosted,Linux,X64
# - Work folder: _work
```

### Step 3: Start Runner

```bash
# Start runner in background
nohup ./run.sh &

# Or if you have root access, install as service:
su -
cd /home/asad/actions-runner
./svc.sh install asad
./svc.sh start
exit
```

### Step 4: Update Workflow File

The workflow file `.github/workflows/deploy-vps-selfhosted.yml` is already created. Just update the path if needed:

```yaml
name: Deploy to Hostinger VPS (Self-Hosted)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: self-hosted
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Deploy application
      run: |
        cd ~/ibm-recap
        git pull origin main
        npm install
        npx pm2 restart ibm-recap || npx pm2 start server/index.js --name ibm-recap
        npx pm2 save
        echo "Deployment completed successfully!"
```

### Step 5: Push to GitHub

```bash
# On your Mac
cd /Users/asadmahmood/Documents/IBM\ 2026/Internal\ Productivity\ Apps/TeamsCallSummarizer-v2

git add .github/workflows/deploy-vps-selfhosted.yml
git commit -m "Add self-hosted runner deployment"
git push public main
```

---

## 🔧 Useful Commands

### PM2 Management
```bash
# If installed globally:
pm2 status
pm2 logs ibm-recap
pm2 restart ibm-recap
pm2 stop ibm-recap
pm2 start ibm-recap

# If installed locally:
npx pm2 status
npx pm2 logs ibm-recap
npx pm2 restart ibm-recap
npx pm2 stop ibm-recap
npx pm2 start ibm-recap
```

### Application Management
```bash
# Navigate to app
cd ~/ibm-recap

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart app
npx pm2 restart ibm-recap
```

### Check App Status
```bash
# Test locally
curl http://localhost:3000

# Check logs
npx pm2 logs ibm-recap

# Monitor
npx pm2 monit
```

---

## 🎯 Your Deployment Workflow

Once the self-hosted runner is set up:

1. **Make changes locally** in VS Code
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push public main
   ```
3. **GitHub Actions automatically:**
   - Runs on your VPS
   - Pulls latest code
   - Installs dependencies
   - Restarts the app
   - Done in ~30 seconds!

---

## 🔍 Troubleshooting

### PM2 Permission Issues
```bash
# Install PM2 locally instead of globally
npm install pm2
# Then use: npx pm2 instead of pm2
```

### App Not Starting
```bash
# Check logs
npx pm2 logs ibm-recap

# Check if port 3000 is in use
netstat -tulpn | grep 3000

# Restart app
npx pm2 restart ibm-recap
```

### Can't Install Packages
```bash
# Check npm permissions
npm config get prefix

# If it's /usr/local, set it to your home:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Need Root Access
If you need to install system packages (FFmpeg, Nginx), contact Hostinger support or use their control panel to request root access.

---

## ✅ Summary

**What You Have:**
- ✅ Node.js v25.8.0 (latest!)
- ✅ npm 11.11.0
- ✅ Tailscale VPN protection
- ✅ User account: asad

**What You Need:**
- Install FFmpeg (may need root)
- Install PM2 (can do without root)
- Clone and run your app
- Setup self-hosted runner for CI/CD

**Access Your App:**
- Direct: `http://100.x.x.x:3000`
- With Nginx: `http://100.x.x.x`
- Must be on Tailscale network

**Deploy Updates:**
Just `git push public main` and it auto-deploys!

---

## 🆘 If You Need Help

**For system packages (FFmpeg, Nginx):**
- Contact Hostinger support
- Request root access or ask them to install

**For Node.js/npm issues:**
- Use `npx` prefix for locally installed packages
- Install packages without sudo in your home directory

**Your IBM Recap app is ready to deploy! 🎊**