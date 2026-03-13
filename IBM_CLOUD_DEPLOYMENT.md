# IBM Cloud Foundry Deployment Guide

Complete step-by-step guide to deploy IBM Recap to IBM Cloud Foundry with w3ID authentication.

---

## 📋 Prerequisites

- IBM Cloud account (free tier available)
- IBM Cloud CLI installed
- Git repository pushed to GitHub

---

## 🚀 Step-by-Step Deployment

### Step 1: Install IBM Cloud CLI

```bash
# Install IBM Cloud CLI
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh

# Verify installation
ibmcloud --version
```

### Step 2: Login to IBM Cloud

```bash
# Login with SSO (recommended for IBMers)
ibmcloud login --sso

# Follow the prompts:
# 1. Open the URL in browser
# 2. Get one-time passcode
# 3. Paste passcode in terminal
# 4. Select your IBM Cloud account
```

### Step 3: Target Cloud Foundry

```bash
# Target Cloud Foundry environment
ibmcloud target --cf

# Select:
# - Region: us-south (or your preferred region)
# - Org: Your organization
# - Space: dev (or create new space)
```

### Step 4: Create IBM App ID Service

```bash
# Create App ID service instance (free tier)
ibmcloud resource service-instance-create ibm-recap-appid appid lite us-south

# Wait for service to be created (takes ~1 minute)
ibmcloud resource service-instance ibm-recap-appid
```

### Step 5: Create Service Key

```bash
# Create service key for App ID
ibmcloud resource service-key-create ibm-recap-appid-key Manager --instance-name ibm-recap-appid

# View credentials (save these for later)
ibmcloud resource service-key ibm-recap-appid-key
```

### Step 6: Deploy Application

```bash
# Navigate to your project directory
cd "/Users/asadmahmood/Documents/IBM 2026/Internal Productivity Apps/TeamsCallSummarizer-v2"

# Deploy to Cloud Foundry
ibmcloud cf push

# This will:
# - Upload your code
# - Install dependencies
# - Start the application
# - Bind App ID service
# - Provide you with the URL
```

### Step 7: Configure App ID for w3ID

After deployment, configure App ID in IBM Cloud Console:

1. **Go to IBM Cloud Console**: https://cloud.ibm.com
2. **Navigate to**: Resource List → Services → ibm-recap-appid
3. **Click**: "Manage Authentication"
4. **Add Identity Provider**:
   - Click "Add" under Identity Providers
   - Select "SAML"
   - Configure w3ID SAML settings:
     - **Name**: IBM w3ID
     - **Entity ID**: `https://w3id.sso.ibm.com/auth/sps/samlidp/saml20`
     - **Sign-in URL**: `https://w3id.sso.ibm.com/auth/sps/samlidp/saml20/logininitial`
     - **Primary certificate**: (Contact IBM SSO team for certificate)

5. **Configure Redirect URLs**:
   - Go to "Manage Authentication" → "Authentication Settings"
   - Add redirect URL: `https://ibm-recap.us-south.cf.appdomain.cloud/callback`
   - Add web redirect URL: `https://ibm-recap.us-south.cf.appdomain.cloud/*`

6. **Save Configuration**

### Step 8: Set Environment Variables

```bash
# Set environment variables for your app
ibmcloud cf set-env ibm-recap OPENAI_API_KEY "your-openai-key"
ibmcloud cf set-env ibm-recap WATSON_STT_API_KEY "your-watson-key"
ibmcloud cf set-env ibm-recap WATSONX_API_KEY "your-watsonx-key"
ibmcloud cf set-env ibm-recap WATSONX_PROJECT_ID "your-project-id"

# Restage app to apply changes
ibmcloud cf restage ibm-recap
```

### Step 9: Verify Deployment

```bash
# Check app status
ibmcloud cf app ibm-recap

# View logs
ibmcloud cf logs ibm-recap --recent

# Open app in browser
ibmcloud cf app ibm-recap
```

---

## 🌐 Your App URL

After deployment, your app will be available at:

```
https://ibm-recap.us-south.cf.appdomain.cloud
```

Share this URL with other IBMers!

---

## 🔐 Testing w3ID Authentication

1. Open your app URL in browser
2. You should be redirected to IBM w3ID login
3. Enter your IBM credentials
4. After authentication, you'll be redirected back to IBM Recap
5. You should see your IBM profile information

---

## 📊 Monitoring & Management

### View App Status
```bash
ibmcloud cf app ibm-recap
```

### View Logs (Real-time)
```bash
ibmcloud cf logs ibm-recap
```

### View Recent Logs
```bash
ibmcloud cf logs ibm-recap --recent
```

### Restart App
```bash
ibmcloud cf restart ibm-recap
```

### Scale App
```bash
# Increase memory
ibmcloud cf scale ibm-recap -m 1G

# Increase instances
ibmcloud cf scale ibm-recap -i 2
```

### View Environment Variables
```bash
ibmcloud cf env ibm-recap
```

---

## 🔄 Updating Your App

When you make changes to your code:

```bash
# Method 1: Simple push
ibmcloud cf push

# Method 2: Zero-downtime deployment
ibmcloud cf push ibm-recap-new
ibmcloud cf map-route ibm-recap-new us-south.cf.appdomain.cloud --hostname ibm-recap
ibmcloud cf unmap-route ibm-recap us-south.cf.appdomain.cloud --hostname ibm-recap
ibmcloud cf delete ibm-recap -f
ibmcloud cf rename ibm-recap-new ibm-recap
```

---

## 🆘 Troubleshooting

### App Won't Start
```bash
# Check logs
ibmcloud cf logs ibm-recap --recent

# Common issues:
# - Missing dependencies: Check package.json
# - Port binding: App should listen on process.env.PORT
# - Memory limit: Increase in manifest.yml
```

### Authentication Not Working
```bash
# Verify App ID service is bound
ibmcloud cf services

# Check environment variables
ibmcloud cf env ibm-recap

# Verify redirect URLs in App ID console
```

### Out of Memory
```bash
# Increase memory allocation
ibmcloud cf scale ibm-recap -m 1G

# Or update manifest.yml and push again
```

---

## 💰 Cost Estimation

**Free Tier Includes:**
- 256MB RAM (sufficient for this app)
- App ID: 1000 users, 1000 events/month
- No credit card required

**If you exceed free tier:**
- Additional RAM: ~$0.05/GB-hour
- App ID: $0.01 per additional event

**For internal IBM tool with ~50 users:**
- Expected cost: **$0/month** (within free tier)

---

## 🔒 Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Enable HTTPS only** - Already enabled by default
3. **Restrict access** - Use App ID to limit to IBM employees
4. **Regular updates** - Keep dependencies updated
5. **Monitor logs** - Check for suspicious activity

---

## 📝 Quick Reference Commands

```bash
# Login
ibmcloud login --sso

# Target CF
ibmcloud target --cf

# Deploy
ibmcloud cf push

# View logs
ibmcloud cf logs ibm-recap

# Restart
ibmcloud cf restart ibm-recap

# Delete app
ibmcloud cf delete ibm-recap
```

---

## 🎯 Next Steps

After successful deployment:

1. ✅ Test the application
2. ✅ Configure w3ID authentication
3. ✅ Share URL with team members
4. ✅ Set up monitoring
5. ✅ Configure custom domain (optional)

---

## 📞 Support

- **IBM Cloud Docs**: https://cloud.ibm.com/docs
- **App ID Docs**: https://cloud.ibm.com/docs/appid
- **Cloud Foundry Docs**: https://docs.cloudfoundry.org
- **IBM Support**: Open ticket in IBM Cloud Console

---

## ✅ Deployment Checklist

- [ ] IBM Cloud CLI installed
- [ ] Logged in to IBM Cloud
- [ ] Cloud Foundry targeted
- [ ] App ID service created
- [ ] Application deployed
- [ ] Environment variables set
- [ ] w3ID authentication configured
- [ ] Redirect URLs configured
- [ ] Application tested
- [ ] URL shared with team

**You're ready to deploy!** 🚀