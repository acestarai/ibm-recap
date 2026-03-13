# Hostinger VPS Deployment Guide for IBM Recap

This guide walks you through deploying IBM Recap to your Hostinger VPS with automatic CI/CD from GitHub.

## 📋 Prerequisites

- Hostinger VPS with SSH access
- Domain name (optional, but recommended)
- GitHub repository: https://github.com/acestarai/ibm-recap

## 🎯 Deployment Overview

We'll set up:
1. **VPS Environment** - Node.js, PM2, Nginx
2. **Application Deployment** - Clone and run your app
3. **CI/CD Pipeline** - GitHub Actions for auto-deployment
4. **Reverse Proxy** - Nginx for production serving
5. **SSL Certificate** - Free HTTPS with Let's Encrypt (optional)

---

## Part 1: Initial VPS Setup

### Step 1: Connect to Your VPS

```bash
ssh root@your-vps-ip
# Or if you have a username:
ssh username@your-vps-ip
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

# This will install all dependencies from package.json
```

### Step 4: Create Environment File

```bash
# Create .env file
nano .env
```

Add your environment variables (optional, as users can provide keys in UI):
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
# Follow the command it outputs (usually starts with 'sudo env PATH=...')

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
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or VPS IP

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

**If you don't have a domain yet**, use your VPS IP:
```nginx
server_name your-vps-ip;
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 2: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 3: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable

# Check status
sudo ufw status
```

### Step 4: Test Your Application

Open your browser and visit:
- `http://your-vps-ip` or
- `http://your-domain.com`

You should see IBM Recap running! 🎉

---

## Part 4: Setup CI/CD with GitHub Actions

### Step 1: Create Deploy User on VPS

```bash
# Create a deploy user
sudo adduser deploy

# Add to sudo group (optional)
sudo usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### Step 2: Generate SSH Key for GitHub Actions

```bash
# Generate SSH key (as deploy user)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Display public key
cat ~/.ssh/github_deploy.pub
```

### Step 3: Add Public Key to Authorized Keys

```bash
# Add public key to authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Step 4: Get Private Key for GitHub

```bash
# Display private key (copy this entire output)
cat ~/.ssh/github_deploy
```

Copy the entire private key (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)

### Step 5: Add Secrets to GitHub

1. Go to your GitHub repository: https://github.com/acestarai/ibm-recap
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `VPS_HOST` | Your VPS IP address (e.g., `123.45.67.89`) |
| `VPS_USERNAME` | `deploy` |
| `VPS_SSH_KEY` | The private key you copied above |
| `VPS_PORT` | `22` (or your custom SSH port) |

### Step 6: Create GitHub Actions Workflow

Create this file in your local repository:

```bash
# In your local project directory
mkdir -p .github/workflows
nano .github/workflows/deploy-vps.yml
```

Add this workflow configuration:

```yaml
name: Deploy to Hostinger VPS

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to VPS
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USERNAME }}
        key: ${{ secrets.VPS_SSH_KEY }}
        port: ${{ secrets.VPS_PORT }}
        script: |
          cd /var/www/ibm-recap
          git pull origin main
          npm install
          pm2 restart ibm-recap
          pm2 save
          echo "Deployment completed successfully!"
```

### Step 7: Commit and Push

```bash
# Add the workflow file
git add .github/workflows/deploy-vps.yml
git commit -m "Add VPS deployment workflow"
git push public main
```

### Step 8: Verify Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. You should see the workflow running
4. Once complete, your VPS will have the latest code!

---

## Part 5: Optional - Setup SSL with Let's Encrypt

### Prerequisites
- You must have a domain name pointing to your VPS IP

### Step 1: Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Obtain SSL Certificate

```bash
# Replace with your actual domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### Step 3: Test Auto-Renewal

```bash
# Test renewal process
sudo certbot renew --dry-run
```

Certbot will automatically renew your certificate before it expires!

---

## 🔧 Useful Commands

### PM2 Management
```bash
# View app status
pm2 status

# View logs
pm2 logs ibm-recap

# Restart app
pm2 restart ibm-recap

# Stop app
pm2 stop ibm-recap

# Start app
pm2 start ibm-recap

# Monitor resources
pm2 monit
```

### Nginx Management
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log
```

### Application Management
```bash
# Navigate to app directory
cd /var/www/ibm-recap

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart app
pm2 restart ibm-recap
```

---

## 🚀 Your CI/CD Workflow

Once set up, your workflow is:

1. **Make changes locally** in VS Code
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "Your change description"
   ```
3. **Push to GitHub:**
   ```bash
   git push public main
   ```
4. **GitHub Actions automatically:**
   - Connects to your VPS via SSH
   - Pulls latest code
   - Installs dependencies
   - Restarts the app with PM2
   - Your changes are live! (~30 seconds)

---

## 🔍 Troubleshooting

### App Not Starting
```bash
# Check PM2 logs
pm2 logs ibm-recap

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart app
pm2 restart ibm-recap
```

### Nginx Issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### GitHub Actions Failing
1. Check Actions tab in GitHub for error messages
2. Verify SSH key is correct in GitHub Secrets
3. Test SSH connection manually:
   ```bash
   ssh -i ~/.ssh/github_deploy deploy@your-vps-ip
   ```

### Permission Issues
```bash
# Fix ownership
sudo chown -R deploy:deploy /var/www/ibm-recap

# Fix permissions
chmod -R 755 /var/www/ibm-recap
```

---

## 📊 Monitoring

### Check App Health
```bash
# PM2 status
pm2 status

# System resources
htop

# Disk usage
df -h

# Memory usage
free -h
```

### View Logs
```bash
# Application logs
pm2 logs ibm-recap

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🎯 Summary

**Your VPS Setup:**
- ✅ Node.js 18 + FFmpeg installed
- ✅ PM2 managing your app
- ✅ Nginx reverse proxy
- ✅ GitHub Actions CI/CD
- ✅ Auto-deployment on push
- ✅ Optional SSL/HTTPS

**Access Your App:**
- HTTP: `http://your-vps-ip` or `http://your-domain.com`
- HTTPS: `https://your-domain.com` (if SSL configured)

**Deploy Updates:**
Just `git push public main` and GitHub Actions handles the rest!

---

## 🆘 Need Help?

Common issues and solutions are in the Troubleshooting section above. For VPS-specific issues, check Hostinger's documentation or support.

**Your IBM Recap app is now running on your own VPS with automatic deployments! 🎊**