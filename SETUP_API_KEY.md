# 🔑 API Key Setup Guide

## Step 1: Get Google AI API Key

1. Go to: **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Choose existing project or create new one
5. Copy your API key (starts with `AIzaSy...`)

## Step 2: Local Development Setup

Create a file named `.env` in the **root directory**:

```env
# Google AI Studio API Key
GOOGLE_AI_API_KEY=AIzaSy_paste_your_actual_key_here

# Frontend URL for CORS (optional for local development)
FRONTEND_URL=http://localhost:3000
```

⚠️ **Important:** Never commit `.env` file to Git! (Already in .gitignore)

## Step 3: Railway Production Setup

1. Go to your Railway project: https://railway.app
2. Click on your backend service
3. Go to **"Variables"** tab
4. Click **"+ New Variable"**
5. Add:
   - **Name:** `GOOGLE_AI_API_KEY`
   - **Value:** `AIzaSy_your_actual_key_here`
6. Click **"Add"**
7. Railway will automatically redeploy! ✅

## Step 4: Test It

### Local Test:
```bash
# Start backend
python main.py

# Should see in logs:
✓ Google AI configured successfully
```

### Production Test:
1. Open your Vercel URL
2. Enter a website URL and keywords
3. Click "Generate Content"
4. Wait 30-60 seconds
5. Should see posts and images! 🎉

## Cost Estimates

**Google AI Pricing:**
- Gemini 2.5 Pro (text): ~$0.01-0.02 per generation
- Gemini 2.5 Flash Image: ~$0.12 per generation
- **Total: ~$0.13-0.14 per full generation**

**Monthly estimates:**
- 100 generations: ~$13-14
- 500 generations: ~$65-70
- 1000 generations: ~$130-140

**70% cheaper than OpenAI GPT-4 + DALL-E!** 💰

## Troubleshooting

### ❌ "API key not found"
- Check `.env` file exists in root directory
- Check variable name is exactly `GOOGLE_AI_API_KEY`
- Restart backend after adding `.env`

### ❌ "Invalid API key"
- Verify key is correct (starts with `AIzaSy`)
- Check key is enabled in Google AI Studio
- Try creating a new key

### ❌ "Quota exceeded"
- Check Google AI Studio billing
- You may have hit free tier limit
- Upgrade to paid plan if needed

## Free Tier Limits (Google AI)

**Gemini 2.5 Pro:**
- 50 requests per day (free)
- Then $0.00025 per 1K characters

**Gemini 2.5 Flash Image:**
- Limited free tier
- Then pay-as-you-go pricing

💡 **Tip:** Start with free tier, upgrade when needed!
