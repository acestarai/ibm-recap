# Hostinger VPS Deployment with Tailscale VPN

This guide walks you through deploying IBM Recap to your Hostinger VPS that's protected by Tailscale VPN, with automatic CI/CD from GitHub.

## 🔒 Important: Tailscale VPN Setup

Your VPS is protected by Tailscale VPN, which means:
- ✅ **More secure** - Only accessible through your private Tailscale network
- ✅ **No public SSH exposure** - Firewall blocks direct SSH access
- ⚠️ **Requires Tailscale connection** - You must be connected to Tailscale to access the VPS

---

## 📋 Prerequisites

- Hostinger VPS with Tailscale installed
- Tailscale account and network set up
- SSH access via Tailscale IP
- GitHub repository: https://github.com/acestarai/ibm-recap

---

## Part 0: Connect to Tailscale Network

### Step 1: Install Tailscale on Your Mac (if not already installed)

```bash
# Install Tailscale via Homebrew
brew install tailscale

# Or download from: https://tailscale.com/download
```

### Step 2: Start Tailscale and Connect

```bash
# Start Tailscale
sudo tailscale up

# Check your Tailscale status
tailscale status

# You should see your VPS listed with its Tailscale IP (usually 100.x.x.x)
```

### Step 3: Find Your VPS Tailscale IP

```bash
# List all devices in your Tailscale network
tailscale status

# Look for your Hostinger VPS - it will have an IP like:
# 100.64.x.x or 100.x.x.x
```

### Step 4: Test SSH Connection via Tailscale

```bash
# SSH using Tailscale IP (replace with your actual Tailscale IP)
ssh asad@100.x.x.x

# Or if you set up a Tailscale hostname:
ssh asad@your-vps-hostname.tailnet-name.ts.net
```

**Note:** Replace `100.x.x.x` with your actual Tailscale IP from `tailscale status`

---

## Part 1: Initial VPS Setup

### Step 1: Connect to Your VPS via Tailscale

```bash
# Make sure Tailscale is running
tailscale status

# SSH into your VPS using Tailscale IP
ssh asad@100.x.x.x
```

### Step 2: Update System

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git build-essential
```

### Step 3: Install Node.js 18

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### Step 4: Install FFmpeg (Required for Audio Processing)

```bash
sudo apt install -y ffmpeg

# Verify installation
ffmpeg -version
```

### Step 5: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 6: Install Nginx (Web Server)

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

---

## Part 2: Deploy Your Application

### Step 1: Create Application Directory

```bash
# Create directory for your app
sudo mkdir -p /var/www/ibm-recap
sudo chown -R $USER:$USER /var/www/ibm-recap
cd /var/www/ibm-recap
```

### Step 2: Clone Your Repository

```bash
# Clone from GitHub
git clone https://github.com/acestarai/ibm-recap.git .

# Verify files
ls -la
```

### Step 3: Install Dependencies

```bash
# Install npm packages
npm install
```

### Step 4: Create Environment File

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

### Step 5: Start Application with PM2

```bash
# Start the app with PM2
pm2 start server/index.js --name ibm-recap

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs

# Check app status
pm2 status
pm2 logs ibm-recap
```

---

## Part 3: Configure Nginx Reverse Proxy

### Step 1: Create Nginx Configuration

```bash
# Create Nginx config file
sudo nano /etc/nginx/sites-available/ibm-recap
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name _;  # Accept all hostnames (since we're behind Tailscale)

    # Increase client body size for audio uploads
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
        
        # Timeout settings for long-running requests
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 2: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 3: Test Your Application

Open your browser and visit:
- `http://100.x.x.x` (your Tailscale IP)
- Or `http://your-vps-hostname.tailnet-name.ts.net`

**Important:** You must be connected to Tailscale to access the app!

---

## Part 4: Setup CI/CD with GitHub Actions (Tailscale-Aware)

Since your VPS is behind Tailscale, we need a special setup for GitHub Actions.

### Option A: GitHub Actions Runner on VPS (Recommended)

This runs the deployment directly on your VPS, bypassing the need for external SSH access.

#### Step 1: Install GitHub Actions Runner on VPS

```bash
# Create a directory for the runner
mkdir -p ~/actions-runner && cd ~/actions-runner

# Download the latest runner (check https://github.com/actions/runner/releases for latest version)
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract the installer
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
```

#### Step 2: Configure the Runner

1. Go to your GitHub repository: https://github.com/acestarai/ibm-recap
2. Click **Settings** → **Actions** → **Runners**
3. Click **New self-hosted runner**
4. Select **Linux** and **x64**
5. Copy the configuration command shown (it will include a token)

```bash
# Run the configuration command from GitHub (example):
./config.sh --url https://github.com/acestarai/ibm-recap --token YOUR_TOKEN_HERE

# When prompted:
# - Runner name: hostinger-vps
# - Runner group: Default
# - Labels: self-hosted,Linux,X64
# - Work folder: _work
```

#### Step 3: Install and Start Runner as a Service

```bash
# Install the service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

#### Step 4: Create Self-Hosted Runner Workflow

Create a new workflow file locally:

```bash
# In your local project directory
nano .github/workflows/deploy-vps-selfhosted.yml
```

Add this content:

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
        cd /var/www/ibm-recap
        git pull origin main
        npm install
        pm2 restart ibm-recap
        pm2 save
        echo "Deployment completed successfully!"
```

#### Step 5: Commit and Push

```bash
git add .github/workflows/deploy-vps-selfhosted.yml
git commit -m "Add self-hosted runner deployment workflow"
git push public main
```

---

### Option B: Tailscale GitHub Action (Alternative)

If you prefer not to run a self-hosted runner, you can use Tailscale's GitHub Action.

#### Step 1: Get Tailscale Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Click **Generate auth key**
3. Enable **Reusable** and **Ephemeral**
4. Copy the key (starts with `tskey-auth-`)

#### Step 2: Add Secrets to GitHub

1. Go to https://github.com/acestarai/ibm-recap
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `TAILSCALE_AUTHKEY` | Your Tailscale auth key |
| `VPS_TAILSCALE_IP` | Your VPS Tailscale IP (e.g., `100.x.x.x`) |
| `VPS_USERNAME` | `asad` |
| `VPS_SSH_KEY` | Your SSH private key |

#### Step 3: Generate SSH Key (if needed)

On your Mac:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_vps

# Copy public key
cat ~/.ssh/github_vps.pub
```

On your VPS (via Tailscale):
```bash
# Add public key to authorized_keys
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Get private key for GitHub:
```bash
# On your Mac
cat ~/.ssh/github_vps
```

Copy the entire private key to GitHub Secrets as `VPS_SSH_KEY`

#### Step 4: Create Tailscale-Aware Workflow

```bash
# In your local project directory
nano .github/workflows/deploy-vps-tailscale.yml
```

Add this content:

```yaml
name: Deploy to Hostinger VPS (via Tailscale)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Connect to Tailscale
      uses: tailscale/github-action@v2
      with:
        oauth-client-id: ${{ secrets.TAILSCALE_OAUTH_CLIENT_ID }}
        oauth-secret: ${{ secrets.TAILSCALE_OAUTH_SECRET }}
        tags: tag:ci
    
    - name: Deploy to VPS
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.VPS_TAILSCALE_IP }}
        username: ${{ secrets.VPS_USERNAME }}
        key: ${{ secrets.VPS_SSH_KEY }}
        port: 22
        script: |
          cd /var/www/ibm-recap
          git pull origin main
          npm install
          pm2 restart ibm-recap
          pm2 save
          echo "Deployment completed successfully!"
```

#### Step 5: Commit and Push

```bash
git add .github/workflows/deploy-vps-tailscale.yml
git commit -m "Add Tailscale-aware deployment workflow"
git push public main
```

---

## Part 5: Access Your Application

### From Your Mac (Connected to Tailscale)

```bash
# Make sure Tailscale is running
tailscale status

# Open in browser
open http://100.x.x.x
# Or
open http://your-vps-hostname.tailnet-name.ts.net
```

### From Other Devices

1. Install Tailscale on the device
2. Log in to your Tailscale account
3. Access the app via Tailscale IP or hostname

---

## 🔧 Useful Commands

### Tailscale Management
```bash
# Check Tailscale status
tailscale status

# Show your Tailscale IP
tailscale ip

# Restart Tailscale
sudo tailscale down
sudo tailscale up

# List all devices in network
tailscale status --json | jq
```

### PM2 Management
```bash
# View app status
pm2 status

# View logs
pm2 logs ibm-recap

# Restart app
pm2 restart ibm-recap

# Monitor resources
pm2 monit
```

### Nginx Management
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🚀 Your CI/CD Workflow

### Option A: Self-Hosted Runner
1. Make changes locally
2. Commit and push to GitHub
3. GitHub Actions runs on your VPS directly
4. App updates automatically (~30 seconds)

### Option B: Tailscale GitHub Action
1. Make changes locally
2. Commit and push to GitHub
3. GitHub Actions connects via Tailscale
4. Deploys to your VPS (~1 minute)

---

## 🔍 Troubleshooting

### Can't Connect to VPS
```bash
# Check Tailscale is running
tailscale status

# Restart Tailscale
sudo tailscale down
sudo tailscale up

# Verify VPS is online in Tailscale
tailscale ping 100.x.x.x
```

### GitHub Actions Failing (Self-Hosted)
```bash
# Check runner status on VPS
cd ~/actions-runner
sudo ./svc.sh status

# View runner logs
sudo journalctl -u actions.runner.* -f
```

### App Not Starting
```bash
# Check PM2 logs
pm2 logs ibm-recap

# Restart app
pm2 restart ibm-recap

# Check if port 3000 is in use
sudo lsof -i :3000
```

---

## 📊 Summary

**Your Secure Setup:**
- ✅ VPS protected by Tailscale VPN
- ✅ No public SSH exposure
- ✅ Secure access only through your private network
- ✅ Automatic deployments via GitHub Actions
- ✅ Self-hosted runner or Tailscale GitHub Action

**Access Your App:**
- Via Tailscale IP: `http://100.x.x.x`
- Via Tailscale hostname: `http://your-vps.tailnet.ts.net`
- Must be connected to Tailscale network

**Deploy Updates:**
Just `git push public main` and GitHub Actions handles the rest!

---

## 🎯 Recommended Approach

**I recommend Option A (Self-Hosted Runner)** because:
- ✅ Simpler setup (no Tailscale OAuth needed)
- ✅ Faster deployments (runs directly on VPS)
- ✅ More reliable (no external network dependencies)
- ✅ Better for Tailscale-protected VPS

**Your IBM Recap app is now securely deployed on your Tailscale-protected VPS! 🎊**