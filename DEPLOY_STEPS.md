# 🚀 Quick Deploy Steps

## Prerequisites
- GitHub account
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- OpenAI API key

---

## Step-by-Step Deployment

### 1️⃣ Push to GitHub (if not done yet)

```bash
git init
git add .
git commit -m "Initial commit - Phase 1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

### 2️⃣ Deploy Backend to Railway

1. **Go to Railway:** https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. **Connect GitHub** and select your repository
4. Railway will detect Python project
5. **Add environment variable:**
   - Click on your service → Variables tab
   - Add: `OPENAI_API_KEY` = `sk-proj-xxxxx`
6. Wait for deployment (~2-3 minutes)
7. **Get your URL:**
   - Go to Settings → Networking
   - Copy the public URL (e.g., `https://your-app.up.railway.app`)
8. **Test it:** Open `https://your-app.up.railway.app/` in browser
   - Should see: `{"status": "Social Media Automation API Running"}`

---

### 3️⃣ Deploy Frontend to Vercel

1. **Go to Vercel:** https://vercel.com/new
2. **Import Git Repository** → select your repo
3. **Configure project:**
   - Framework Preset: **Vite**
   - Root Directory: **frontend**
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
4. **Add Environment Variable:**
   - Name: `VITE_API_URL`
   - Value: `https://your-app.up.railway.app` (from step 2)
5. Click **Deploy**
6. Wait ~1-2 minutes
7. **Get your URL:** e.g., `https://your-project.vercel.app`

---

### 4️⃣ Update Backend CORS

1. Go back to **Railway**
2. Click your service → Variables
3. **Add new variable:**
   - Name: `FRONTEND_URL`
   - Value: `https://your-project.vercel.app`
4. Click **Redeploy** (if it doesn't auto-redeploy)

---

### 5️⃣ Test Everything

1. Open your Vercel URL: `https://your-project.vercel.app`
2. Enter a website URL (e.g., `https://apple.com`)
3. Add keywords
4. Click "Generate Content"
5. Wait 30-60 seconds
6. Should see generated posts! 🎉

---

## 🐛 If Something Goes Wrong

### Backend Issues:

**Check Railway Logs:**
```
Railway Dashboard → Your Service → View Logs
```

**Common issues:**
- ❌ `OPENAI_API_KEY not found` → Add the variable
- ❌ `ModuleNotFoundError` → Check requirements.txt
- ❌ `Port binding error` → Railway handles PORT automatically

### Frontend Issues:

**Check Vercel Logs:**
```
Vercel Dashboard → Your Project → Deployments → Click latest → View Logs
```

**Common issues:**
- ❌ `Cannot connect to backend` → Check `VITE_API_URL`
- ❌ `CORS error` → Update `FRONTEND_URL` in Railway
- ❌ `404 Not Found` → Check build output directory

### CORS Issues:

**See CORS errors in browser console?**

1. Open browser DevTools (F12) → Console
2. If you see CORS error:
   - Go to Railway → Variables
   - Check `FRONTEND_URL` matches your Vercel URL exactly
   - Redeploy backend

---

## 📝 Final Checklist

- [ ] Backend deployed to Railway
- [ ] `OPENAI_API_KEY` added to Railway
- [ ] Backend health check returns 200
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` added to Vercel
- [ ] `FRONTEND_URL` added to Railway backend
- [ ] Can access frontend URL
- [ ] Can generate content successfully
- [ ] No CORS errors in browser console

---

## 💡 Pro Tips

**Custom Domains (Optional):**
- Railway: Settings → Domains → Add custom domain
- Vercel: Settings → Domains → Add custom domain

**Monitor Usage:**
- Railway: Dashboard shows usage stats
- OpenAI: https://platform.openai.com/usage

**Update Code:**
```bash
# Make changes locally
git add .
git commit -m "Update: description"
git push

# Both Railway and Vercel auto-deploy on push! 🚀
```

---

## 🎯 URLs to Save

After deployment, save these:

```
Frontend: https://your-project.vercel.app
Backend:  https://your-app.up.railway.app
OpenAI:   https://platform.openai.com/usage
Railway:  https://railway.app/dashboard
Vercel:   https://vercel.com/dashboard
```

---

## 💰 Free Tier Limits

**Railway:**
- $5 free credit (good for ~500 execution hours)
- After that: ~$5-10/month

**Vercel:**
- 100 GB bandwidth/month (plenty for starting)
- Free forever for hobby projects

**OpenAI:**
- Pay-as-you-go
- ~$0.20-0.35 per content generation

---

## ⚡ Next Steps

Once deployed:
1. Share the link and get feedback
2. Monitor OpenAI costs
3. Gather user data
4. Decide on Phase 2 features based on usage

---

Need help? Railway docs: https://docs.railway.app
Vercel docs: https://vercel.com/docs

