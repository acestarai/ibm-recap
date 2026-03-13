# Setup IBM Recap on https://ibm-recap.fedce.tech

Perfect! You have a domain. Let's set up IBM Recap on `https://ibm-recap.fedce.tech`

## 🎯 Goal

Deploy IBM Recap to: `https://ibm-recap.fedce.tech`

---

## 📋 Step-by-Step Setup

### Step 1: Configure DNS in Hostinger

1. **Log in to Hostinger Control Panel**
   - Go to https://hpanel.hostinger.com
   - Log in with your credentials

2. **Navigate to DNS Settings**
   - Click on **Domains**
   - Select **fedce.tech**
   - Click **DNS / Name Servers**

3. **Add A Record for Subdomain**
   - Click **Add Record** or **Manage**
   - Add new A record:
   ```
   Type: A
   Name: ibm-recap
   Points to: 187.124.87.237
   TTL: 3600 (or 1 hour)
   ```
   - Click **Save** or **Add Record**

4. **Wait for DNS Propagation**
   - Usually takes 5-30 minutes
   - Can take up to 24 hours in rare cases

---

### Step 2: Verify DNS Propagation

On your Mac, check if DNS is working:

```bash
# Check if subdomain resolves
nslookup ibm-recap.fedce.tech

# Or use dig
dig ibm-recap.fedce.tech

# Should show: 187.124.87.237
```

If it shows your VPS IP, DNS is ready! ✅

---

### Step 3: SSH to Your VPS

```bash
# Connect via Tailscale
ssh asad@100.x.x.x
```

---

### Step 4: Install Nginx (If Not Already Installed)

```bash
# Switch to root
su -

# Update packages
apt update

# Install Nginx
apt install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

---

### Step 5: Open Firewall Ports

```bash
# Still as root
# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Reload firewall
ufw reload

# Check status
ufw status
```

---

### Step 6: Create Nginx Configuration

```bash
# Create config file for ibm-recap subdomain
nano /etc/nginx/sites-available/ibm-recap
```

**Add this configuration:**

```nginx
server {
    listen 80;
    server_name ibm-recap.fedce.tech;

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
        
        # Timeout settings for long-running requests (AI processing)
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

**Save and exit:** Ctrl+X, then Y, then Enter

---

### Step 7: Enable the Site

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/

# Remove default site (if exists)
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Should show: "syntax is ok" and "test is successful"
```

If test is successful, reload Nginx:

```bash
systemctl reload nginx
```

---

### Step 8: Test HTTP Access

```bash
# Exit root
exit

# Test from VPS
curl http://localhost:3000

# Should show HTML output
```

From your Mac (or any computer):
```
http://ibm-recap.fedce.tech
```

**If this works, you're ready for SSL!** ✅

---

### Step 9: Install SSL Certificate (HTTPS)

```bash
# Switch back to root
su -

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d ibm-recap.fedce.tech
```

**Follow the prompts:**

1. **Enter email address:** Your email for renewal notifications
2. **Agree to Terms of Service:** Yes (Y)
3. **Share email with EFF:** Your choice (Y or N)
4. **Redirect HTTP to HTTPS:** Yes (2)

Certbot will:
- ✅ Get SSL certificate from Let's Encrypt
- ✅ Configure Nginx for HTTPS
- ✅ Set up auto-renewal

```bash
# Exit root
exit
```

---

### Step 10: Verify SSL Certificate

```bash
# Check certificate
su -
certbot certificates
exit
```

Should show:
```
Certificate Name: ibm-recap.fedce.tech
  Domains: ibm-recap.fedce.tech
  Expiry Date: [90 days from now]
  Certificate Path: /etc/letsencrypt/live/ibm-recap.fedce.tech/fullchain.pem
```

---

### Step 11: Access Your App!

Open your browser and go to:
```
https://ibm-recap.fedce.tech
```

**Your IBM Recap app should now be live with HTTPS!** 🎊

---

## ✅ Verification Checklist

- [ ] DNS A record added in Hostinger
- [ ] DNS resolves to 187.124.87.237
- [ ] Nginx installed and running
- [ ] Firewall allows ports 80 and 443
- [ ] Nginx config created and enabled
- [ ] HTTP works: `http://ibm-recap.fedce.tech`
- [ ] SSL certificate installed
- [ ] HTTPS works: `https://ibm-recap.fedce.tech`
- [ ] App loads correctly
- [ ] Can record/upload audio
- [ ] Can transcribe and summarize

---

## 🔧 Troubleshooting

### DNS Not Resolving

```bash
# Check DNS
nslookup ibm-recap.fedce.tech

# If not working:
# 1. Wait 5-30 minutes for propagation
# 2. Check Hostinger DNS settings
# 3. Verify A record points to 187.124.87.237
```

### Nginx Test Fails

```bash
# Check configuration syntax
sudo nginx -t

# View error details
sudo tail -f /var/log/nginx/error.log

# Common issues:
# - Typo in config file
# - Missing semicolon
# - Wrong file path
```

### Can't Access HTTP

```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check if port 80 is open
sudo ufw status

# Check if app is running
npx pm2 list

# Test locally
curl http://localhost:3000
```

### SSL Certificate Fails

```bash
# Common issues:
# 1. DNS not propagated yet - wait and try again
# 2. Port 80 not accessible - check firewall
# 3. Nginx not running - restart it

# Retry SSL
sudo certbot --nginx -d ibm-recap.fedce.tech

# Check Certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### App Not Loading

```bash
# Check PM2 status
npx pm2 list

# Check app logs
npx pm2 logs ibm-recap

# Restart app
npx pm2 restart ibm-recap

# Check if port 3000 is in use
sudo lsof -i :3000
```

---

## 🔄 SSL Certificate Auto-Renewal

Certbot automatically sets up renewal. Verify:

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Should show: "Congratulations, all simulated renewals succeeded"
```

Certificates auto-renew every 90 days. No action needed!

---

## 📊 Your Setup Summary

### Domain Configuration:
- **Domain:** fedce.tech
- **Subdomain:** ibm-recap.fedce.tech
- **DNS A Record:** ibm-recap → 187.124.87.237

### VPS Configuration:
- **VPS IP:** 187.124.87.237
- **App Port:** 3000 (internal)
- **Public Port:** 443 (HTTPS)
- **Nginx:** Reverse proxy
- **SSL:** Let's Encrypt (auto-renews)

### Access:
- **Public URL:** https://ibm-recap.fedce.tech
- **Protocol:** HTTPS (secure)
- **Certificate:** Valid for 90 days (auto-renews)

---

## 🎯 Next Steps

### Add More Apps:

You can add more subdomains for other apps:

1. **Add DNS A Record:**
   ```
   Type: A
   Name: app2
   Points to: 187.124.87.237
   ```

2. **Create Nginx Config:**
   ```nginx
   server {
       listen 80;
       server_name app2.fedce.tech;
       location / {
           proxy_pass http://localhost:3001;
           # ... rest of config
       }
   }
   ```

3. **Get SSL:**
   ```bash
   sudo certbot --nginx -d app2.fedce.tech
   ```

4. **Access:**
   ```
   https://app2.fedce.tech
   ```

---

## 🔒 Security Best Practices

### 1. Keep System Updated
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Configure Firewall Properly
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 3. Monitor SSL Expiry
```bash
# Check certificate expiry
sudo certbot certificates
```

### 4. Regular Backups
```bash
# Backup your app
cd ~
tar -czf ibm-recap-backup.tar.gz ibm-recap/
```

### 5. Monitor Logs
```bash
# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# App logs
npx pm2 logs ibm-recap
```

---

## ✅ Success!

**Your IBM Recap app is now live at:**
```
https://ibm-recap.fedce.tech
```

**Features:**
- ✅ Custom subdomain
- ✅ HTTPS (secure)
- ✅ SSL certificate (auto-renews)
- ✅ Professional URL
- ✅ Accessible from any device
- ✅ No port numbers in URL

**Share this URL with anyone!** 🎊

---

## 🆘 Quick Commands Reference

### Check DNS:
```bash
nslookup ibm-recap.fedce.tech
```

### Restart Nginx:
```bash
sudo systemctl restart nginx
```

### Restart App:
```bash
npx pm2 restart ibm-recap
```

### View Logs:
```bash
npx pm2 logs ibm-recap
sudo tail -f /var/log/nginx/error.log
```

### Renew SSL (manual):
```bash
sudo certbot renew
```

### Check SSL Status:
```bash
sudo certbot certificates
```

**Your professional IBM Recap deployment is complete! 🚀**