# 🚀 Deployment Guide

## Architecture

```
Frontend (React + Vite) → Vercel (Free)
Backend (FastAPI + AI)  → Railway ($5/month)
Database (Future)       → Railway PostgreSQL
```

## 📦 Backend Deployment (Railway)

### Step 1: Prepare Backend

1. **Create Railway account:** https://railway.app
2. **Install Railway CLI** (optional):
```bash
npm i -g @railway/cli
railway login
```

### Step 2: Deploy Backend

**Option A: Via GitHub (Recommended)**

1. Push code to GitHub
2. Go to Railway Dashboard → New Project → Deploy from GitHub
3. Select your repository
4. Railway auto-detects Python/FastAPI
5. Add environment variables:
   - `OPENAI_API_KEY` = your OpenAI key
   - `PORT` = 8000 (auto-set by Railway)
   - `FRONTEND_URL` = (will add after Vercel deploy)

**Option B: Via Railway CLI**

```bash
cd backend
railway init
railway up
```

### Step 3: Configure Railway

1. Go to Settings → Networking
2. Copy your Railway URL (e.g., `https://your-app.railway.app`)
3. Settings → Variables → Add:
   ```
   OPENAI_API_KEY=sk-proj-...
   FRONTEND_URL=https://your-frontend.vercel.app
   ```
4. Redeploy if needed

### Step 4: Test Backend

```bash
curl https://your-app.railway.app/
# Should return: {"status": "Social Media Automation API Running"}
```

---

## 🌐 Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

1. Update `frontend/.env.production`:
```env
VITE_API_URL=https://your-app.railway.app
```

### Step 2: Deploy to Vercel

**Option A: Via Vercel Dashboard (Easiest)**

1. Go to https://vercel.com
2. New Project → Import Git Repository
3. Select your repo → Select `frontend` folder as root
4. Framework Preset: Vite
5. Add Environment Variable:
   - `VITE_API_URL` = `https://your-app.railway.app`
6. Deploy!

**Option B: Via Vercel CLI**

```bash
npm i -g vercel
cd frontend
vercel
# Follow prompts
```

### Step 3: Update Backend CORS

Go back to Railway → Variables → Update `FRONTEND_URL`:
```
FRONTEND_URL=https://your-frontend.vercel.app
```

Redeploy backend.

---

## ✅ Verification Checklist

- [ ] Backend health check: `https://your-backend.railway.app/`
- [ ] Frontend loads: `https://your-frontend.vercel.app`
- [ ] API connection works (try generating content)
- [ ] CORS no errors in browser console
- [ ] OpenAI API key working
- [ ] Images generating properly

---

## 💰 Cost Breakdown

### Free Tier (Good for testing):
- **Vercel:** Free (frontend)
- **Railway:** $5 free credit (500 hours)
- **OpenAI:** Pay-per-use (~$0.20-0.35 per generation)

### Production (After free tier):
- **Vercel:** Free (hobby) or $20/month (pro)
- **Railway:** ~$5-10/month (depending on usage)
- **OpenAI:** ~$50-200/month (depends on volume)
- **Total:** ~$55-230/month

---

## 🔧 Environment Variables

### Backend (Railway):
```env
OPENAI_API_KEY=sk-proj-xxxxx
FRONTEND_URL=https://your-frontend.vercel.app
PORT=8000
```

### Frontend (Vercel):
```env
VITE_API_URL=https://your-backend.railway.app
```

---

## 📈 Future Scaling (Phase 2-4)

### When you add Phase 2-4:

**Database (Railway):**
- Add PostgreSQL plugin in Railway
- Auto-generates `DATABASE_URL`
- Update backend to use DB

**Background Jobs:**
- Add Redis (Railway plugin)
- Add Celery worker (separate Railway service)

**File Storage:**
- Use AWS S3 or Cloudinary
- Store generated images permanently

**Caching:**
- Add Redis for API caching
- Cache scraped website data (1 hour)

---

## 🐛 Troubleshooting

### Backend not starting:
- Check Railway logs: Settings → View Logs
- Verify `OPENAI_API_KEY` is set
- Check `requirements.txt` is in root

### Frontend can't reach backend:
- Check CORS settings in `main.py`
- Verify `VITE_API_URL` in Vercel env vars
- Check Railway service is running

### OpenAI errors:
- Verify API key is valid
- Check OpenAI account has credits
- Look at Railway logs for detailed error

### Timeout errors:
- Railway has no timeout (good!)
- If still timing out, check OpenAI API status

---

## 🚀 Quick Deploy Commands

```bash
# Backend (Railway CLI)
cd backend
railway login
railway init
railway up

# Frontend (Vercel CLI)
cd frontend
vercel

# Update env vars
railway variables set OPENAI_API_KEY=sk-...
vercel env add VITE_API_URL production
```

---

## 📝 Post-Deployment

1. **Add custom domain** (optional):
   - Vercel: Settings → Domains
   - Railway: Settings → Domains

2. **Set up monitoring:**
   - Railway has built-in metrics
   - Add Sentry for error tracking (optional)

3. **Configure analytics:**
   - Add Google Analytics to frontend
   - Track API usage in Railway

4. **Backup plan:**
   - Railway auto-backups (if using DB)
   - Export generated content regularly

---

## 🎯 One-Click Deploy (Coming Soon)

We can add deploy buttons later:

[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new)

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new)

---

Need help? Check Railway docs: https://docs.railway.app

