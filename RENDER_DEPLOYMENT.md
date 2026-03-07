# Deploy IBM Recap to Render.com (5 Minutes)

## Why Render.com?

- ✅ **100% Free** - No credit card required
- ✅ **Auto-deploy** - Deploys automatically from GitHub
- ✅ **HTTPS included** - Secure by default
- ✅ **Easy setup** - Just a few clicks
- ✅ **Perfect for internal tools**

---

## Step-by-Step Deployment

### Step 1: Push to GitHub (If Not Done)

```bash
# Add render.yaml to git
git add render.yaml RENDER_DEPLOYMENT.md
git commit -m "Add Render.com deployment configuration"
git push origin main
```

### Step 2: Sign Up for Render.com

1. Go to **https://render.com**
2. Click **"Get Started"**
3. Sign up with **GitHub** (easiest option)
4. Authorize Render to access your repositories

### Step 3: Create New Web Service

1. Click **"New +"** in the top right
2. Select **"Web Service"**
3. Connect your **ibm-recap** repository
4. Render will detect the `render.yaml` file automatically

### Step 4: Configure (Auto-filled from render.yaml)

The configuration is already set in `render.yaml`, but verify:

- **Name**: `ibm-recap`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server/index.js`
- **Plan**: `Free`

### Step 5: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these (if you have the keys):

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `WATSON_STT_API_KEY` | Your Watson STT key (optional) |
| `WATSONX_API_KEY` | Your WatsonX key (optional) |
| `WATSONX_PROJECT_ID` | Your WatsonX project ID (optional) |

**Note**: You can add these later if you don't have them yet.

### Step 6: Deploy!

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Install dependencies
   - Build your application
   - Deploy it
3. Wait 3-5 minutes for first deployment

---

## Your App URL

After deployment, your app will be available at:

```
https://ibm-recap.onrender.com
```

Or a similar URL that Render assigns.

---

## Testing Your Deployment

1. Open the URL in your browser
2. You should see the **Consent Page**
3. Accept consent → See **Onboarding Page**
4. Complete onboarding → See **IBM Recap Main App**
5. Test audio upload/recording features

---

## Updating Your App

Every time you push to GitHub, Render automatically redeploys:

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push origin main

# Render automatically deploys the changes!
```

---

## Adding Environment Variables Later

1. Go to **Render Dashboard**
2. Click on your **ibm-recap** service
3. Go to **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add key and value
6. Click **"Save Changes"**
7. Service will automatically restart

---

## Monitoring & Logs

### View Logs
1. Go to Render Dashboard
2. Click on **ibm-recap**
3. Click **"Logs"** tab
4. See real-time logs

### View Metrics
1. Click **"Metrics"** tab
2. See CPU, memory, and request metrics

---

## Custom Domain (Optional)

Want a custom domain like `recap.yourcompany.com`?

1. Go to **"Settings"** tab
2. Scroll to **"Custom Domain"**
3. Click **"Add Custom Domain"**
4. Follow DNS configuration instructions

---

## Free Tier Limits

Render's free tier includes:
- ✅ 750 hours/month (enough for 24/7 uptime)
- ✅ 512MB RAM
- ✅ Shared CPU
- ✅ Automatic HTTPS
- ✅ Auto-deploy from GitHub

**Perfect for internal tools with moderate usage!**

---

## Troubleshooting

### App Won't Start
- Check logs in Render dashboard
- Verify `package.json` has correct start script
- Ensure all dependencies are in `package.json`

### Environment Variables Not Working
- Make sure they're added in Render dashboard
- Service must restart after adding variables
- Check spelling of variable names

### Deployment Failed
- Check build logs for errors
- Verify `node server/index.js` works locally
- Ensure Node.js version compatibility

---

## Comparison: Render vs IBM Cloud

| Feature | Render.com | IBM Cloud Code Engine |
|---------|------------|----------------------|
| **Cost** | Free | Free (with limits) |
| **Setup Time** | 5 minutes | 30+ minutes |
| **Auto-deploy** | ✅ Yes | ❌ Manual |
| **Storage Issues** | ❌ None | ✅ Registry quota |
| **IBM Infrastructure** | ❌ No | ✅ Yes |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## Next Steps

1. ✅ Push code to GitHub (with render.yaml)
2. ✅ Sign up for Render.com
3. ✅ Connect repository
4. ✅ Deploy (automatic)
5. ✅ Add environment variables
6. ✅ Test your app
7. ✅ Share URL with team

---

## Support

- **Render Docs**: https://render.com/docs
- **Community**: https://community.render.com
- **Status**: https://status.render.com

---

**Ready to deploy? Follow the steps above and your app will be live in 5 minutes!** 🚀