# Custom URL Setup for IBM Recap

Congratulations on getting IBM Recap online! Now let's set up a custom URL so you can access it with a friendly domain name instead of an IP address.

## 🎯 Options for Custom URL

You have several options depending on your needs:

### Option 1: Tailscale MagicDNS (Easiest, Free)
- **URL:** `http://ibm-recap.tailnet-name.ts.net`
- **Access:** Only via Tailscale network
- **Setup Time:** 2 minutes
- **Cost:** Free
- **Best for:** Internal team use

### Option 2: Custom Domain (Public Access)
- **URL:** `http://ibmrecap.yourdomain.com`
- **Access:** Public internet (or restrict with firewall)
- **Setup Time:** 30 minutes
- **Cost:** Domain registration (~$10-15/year)
- **Best for:** Public access or professional URL

### Option 3: Hostinger Subdomain (If Available)
- **URL:** `http://ibm-recap.your-hostinger-domain.com`
- **Access:** Public internet
- **Setup Time:** 15 minutes
- **Cost:** Free (if you have Hostinger domain)
- **Best for:** Quick setup with existing domain

---

## Option 1: Tailscale MagicDNS (Recommended for Internal Use)

### Step 1: Enable MagicDNS

1. Go to https://login.tailscale.com/admin/dns
2. Click **Enable MagicDNS**
3. Your Tailscale network will get a domain like `tail12345.ts.net`

### Step 2: Set Hostname for Your VPS

On your VPS:
```bash
# Set a friendly hostname
sudo tailscale set --hostname ibm-recap
```

Or via Tailscale admin panel:
1. Go to https://login.tailscale.com/admin/machines
2. Find your VPS
3. Click the three dots → **Edit machine name**
4. Set name to: `ibm-recap`

### Step 3: Access Your App

Your app will now be accessible at:
```
http://ibm-recap.tail12345.ts.net:3000
```

Replace `tail12345` with your actual Tailscale network name.

### Step 4: Remove Port Number (Optional)

To access without `:3000`, you need Nginx. If you have root access:

```bash
su -
# Install Nginx
apt update
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/ibm-recap
```

Add:
```nginx
server {
    listen 80;
    server_name ibm-recap.tail12345.ts.net;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }
}
```

Enable and restart:
```bash
ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
exit
```

Now access at: `http://ibm-recap.tail12345.ts.net` (no port needed!)

---

## Option 2: Custom Domain (Public Access)

### Prerequisites
- A domain name (buy from Namecheap, GoDaddy, Google Domains, etc.)
- Root access to your VPS (for Nginx and SSL)

### Step 1: Buy a Domain

Popular registrars:
- **Namecheap** - ~$10/year
- **Google Domains** - ~$12/year
- **Cloudflare** - ~$10/year (includes free SSL proxy)
- **GoDaddy** - ~$15/year

Example domains:
- `ibmrecap.com`
- `recap-ai.com`
- `meetingrecap.app`

### Step 2: Point Domain to Your VPS

#### Option A: Direct DNS (Simple)

In your domain registrar's DNS settings, add an A record:

```
Type: A
Name: @ (or ibm-recap for subdomain)
Value: 187.124.87.237 (your VPS public IP)
TTL: 3600
```

**Note:** This exposes your VPS to the public internet. Make sure your firewall is configured!

#### Option B: Cloudflare Proxy (Recommended)

1. Sign up at https://cloudflare.com (free)
2. Add your domain to Cloudflare
3. Update nameservers at your registrar
4. In Cloudflare DNS, add A record:
   ```
   Type: A
   Name: @ (or ibm-recap)
   Value: 187.124.87.237
   Proxy: ON (orange cloud)
   ```

**Benefits:**
- Free SSL certificate
- DDoS protection
- Hides your real IP
- CDN for faster loading

### Step 3: Install Nginx on VPS

```bash
su -
apt update
apt install -y nginx
```

### Step 4: Configure Nginx

```bash
nano /etc/nginx/sites-available/ibm-recap
```

Add:
```nginx
server {
    listen 80;
    server_name ibmrecap.com www.ibmrecap.com;

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

Enable:
```bash
ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### Step 5: Setup SSL (HTTPS)

#### If Using Cloudflare:
SSL is automatic! Just set SSL mode to "Flexible" or "Full" in Cloudflare dashboard.

#### If Not Using Cloudflare:
```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d ibmrecap.com -d www.ibmrecap.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Redirect HTTP to HTTPS: Yes
```

### Step 6: Configure Firewall

```bash
# Allow HTTP and HTTPS
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw enable
```

### Step 7: Access Your App

- HTTP: `http://ibmrecap.com`
- HTTPS: `https://ibmrecap.com`

---

## Option 3: Hostinger Subdomain

If you already have a domain with Hostinger:

### Step 1: Access Hostinger Control Panel

1. Log in to Hostinger
2. Go to **Domains** section
3. Select your domain

### Step 2: Add DNS Record

Add an A record:
```
Type: A
Name: ibm-recap
Value: 187.124.87.237 (your VPS public IP)
TTL: 3600
```

### Step 3: Setup Nginx (Same as Option 2, Step 3-4)

Use subdomain in Nginx config:
```nginx
server_name ibm-recap.yourdomain.com;
```

### Step 4: Access Your App

```
http://ibm-recap.yourdomain.com
```

---

## 🔒 Security Considerations

### For Public Access (Options 2 & 3):

1. **Firewall Configuration**
   ```bash
   # Only allow specific ports
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow ssh
   ufw allow 'Nginx Full'
   ufw enable
   ```

2. **Fail2Ban (Prevent Brute Force)**
   ```bash
   apt install -y fail2ban
   systemctl enable fail2ban
   systemctl start fail2ban
   ```

3. **Rate Limiting in Nginx**
   Add to Nginx config:
   ```nginx
   limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;
   
   server {
       limit_req zone=one burst=20;
       # ... rest of config
   }
   ```

4. **Keep Tailscale for Admin Access**
   - Use Tailscale for SSH access
   - Disable public SSH (port 22)
   - Only expose HTTP/HTTPS publicly

### For Tailscale-Only Access (Option 1):

- ✅ Already secure (zero-trust network)
- ✅ No public exposure
- ✅ Encrypted connections
- ✅ Access control via Tailscale

---

## 📊 Comparison Table

| Feature | Tailscale MagicDNS | Custom Domain | Hostinger Subdomain |
|---------|-------------------|---------------|---------------------|
| **Cost** | Free | ~$10-15/year | Free |
| **Setup Time** | 2 minutes | 30 minutes | 15 minutes |
| **Public Access** | No | Yes | Yes |
| **SSL/HTTPS** | Optional | Yes (free) | Yes (free) |
| **Custom Branding** | Limited | Full | Partial |
| **Security** | High | Medium | Medium |
| **Best For** | Internal team | Public app | Quick setup |

---

## 🎯 Recommended Approach

### For Internal Team Use:
**Use Tailscale MagicDNS (Option 1)**
- Easiest and most secure
- No domain cost
- Perfect for team collaboration
- URL: `http://ibm-recap.tail12345.ts.net`

### For Public/Client Access:
**Use Custom Domain with Cloudflare (Option 2)**
- Professional appearance
- Free SSL and DDoS protection
- Full control
- URL: `https://ibmrecap.com`

### For Quick Testing:
**Use Hostinger Subdomain (Option 3)**
- Fast setup
- No additional cost
- Good for demos
- URL: `http://ibm-recap.yourdomain.com`

---

## 🚀 Quick Start Commands

### For Tailscale MagicDNS:
```bash
# On VPS
sudo tailscale set --hostname ibm-recap

# Access at:
# http://ibm-recap.your-tailnet.ts.net:3000
```

### For Custom Domain (with Nginx):
```bash
# On VPS (as root)
apt install -y nginx certbot python3-certbot-nginx
nano /etc/nginx/sites-available/ibm-recap
# (add config from above)
ln -s /etc/nginx/sites-available/ibm-recap /etc/nginx/sites-enabled/
certbot --nginx -d yourdomain.com
systemctl restart nginx
```

---

## 🆘 Troubleshooting

### Domain Not Resolving
```bash
# Check DNS propagation
nslookup yourdomain.com
dig yourdomain.com

# Wait 5-60 minutes for DNS propagation
```

### Nginx Not Starting
```bash
# Check configuration
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
# Test SSL
certbot certificates

# Renew manually
certbot renew --dry-run
```

### Can't Access from Internet
```bash
# Check firewall
ufw status

# Check if Nginx is listening
netstat -tulpn | grep nginx
```

---

## ✅ Summary

**You have three options:**

1. **Tailscale MagicDNS** - `http://ibm-recap.tailnet.ts.net` (Internal, Free, 2 min)
2. **Custom Domain** - `https://ibmrecap.com` (Public, $10/year, 30 min)
3. **Hostinger Subdomain** - `http://ibm-recap.yourdomain.com` (Public, Free, 15 min)

**My recommendation:**
- Start with **Tailscale MagicDNS** for immediate use
- Add **Custom Domain** later if you need public access

**Next steps:**
1. Choose your option
2. Follow the setup steps
3. Test your custom URL
4. Share with your team!

**Your IBM Recap app will have a professional custom URL! 🎊**