# Alternative Deployment Options for IBM Recap

## Issue: IBM Container Registry Storage Quota Exceeded

Your IBM Container Registry has reached its storage limit. Here are alternative deployment options:

---

## Option 1: Clean Up Container Registry (Recommended)

### Step 1: List Images
```bash
ibmcloud cr images
```

### Step 2: Delete Old/Unused Images
```bash
# Delete specific image
ibmcloud cr image-rm us.icr.io/namespace/image:tag

# Or delete all images in a namespace
ibmcloud cr image-prune-untagged --restrict namespace
```

### Step 3: Try Deployment Again
```bash
ibmcloud ce application create --name ibm-recap \
  --build-source . \
  --strategy dockerfile \
  --port 8787 \
  --min-scale 0 \
  --max-scale 1 \
  --cpu 0.25 \
  --memory 0.5G
```

---

## Option 2: Deploy Using Docker Hub (Free Alternative)

### Step 1: Build and Push to Docker Hub
```bash
# Login to Docker Hub
docker login

# Build image
docker build -t your-dockerhub-username/ibm-recap:latest .

# Push to Docker Hub
docker push your-dockerhub-username/ibm-recap:latest
```

### Step 2: Deploy from Docker Hub
```bash
ibmcloud ce application create --name ibm-recap \
  --image docker.io/your-dockerhub-username/ibm-recap:latest \
  --port 8787 \
  --min-scale 0 \
  --max-scale 1 \
  --cpu 0.25 \
  --memory 0.5G
```

---

## Option 3: Use Heroku (Easiest Alternative)

### Step 1: Install Heroku CLI
```bash
brew install heroku/brew/heroku
```

### Step 2: Login and Create App
```bash
heroku login
heroku create ibm-recap
```

### Step 3: Deploy
```bash
git push heroku main
```

Your app will be at: `https://ibm-recap.herokuapp.com`

---

## Option 4: Use Render.com (Free, No Credit Card)

### Step 1: Create Account
Go to https://render.com and sign up (free)

### Step 2: Connect GitHub
- Connect your GitHub repository
- Select "ibm-recap" repo

### Step 3: Configure
- Type: Web Service
- Build Command: `npm install`
- Start Command: `node server/index.js`
- Environment: Add your API keys

Deploy automatically happens!

---

## Option 5: Upgrade IBM Container Registry

### Increase Storage Quota
```bash
# Check current plan
ibmcloud cr plan

# Upgrade to standard plan (paid)
ibmcloud cr plan-upgrade standard
```

Cost: ~$0.50/GB/month for storage

---

## Recommended Approach

**For immediate deployment**: Use **Option 4 (Render.com)**
- ✅ Free
- ✅ No credit card required
- ✅ Auto-deploy from GitHub
- ✅ HTTPS included
- ✅ Takes 5 minutes

**For IBM Cloud**: Use **Option 1 (Clean up registry)**
- ✅ Stays on IBM infrastructure
- ✅ Free tier
- ✅ Better for IBM internal tools

---

## Quick Start with Render.com

1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Name: `ibm-recap`
   - Build: `npm install`
   - Start: `node server/index.js`
   - Add environment variables
6. Click "Create Web Service"

Done! You'll get a URL like: `https://ibm-recap.onrender.com`

---

## Need Help?

Let me know which option you'd like to pursue, and I can provide detailed step-by-step instructions!