# 🚀 Quick Start Guide

## ✅ Step 1: Get Real JWT Secret

**IMPORTANT:** You need to get the JWT Secret from Supabase!

1. Go to Supabase Dashboard
2. Settings → API
3. Scroll to **"JWT Settings"** section (NOT "JWT Keys"!)
4. Find **"JWT Secret"** field
5. Click **[Reveal]** → **[Copy]**
6. Replace in `.env`:

```bash
JWT_SECRET=your-real-jwt-secret-here-it-should-be-very-long
```

---

## ✅ Step 2: Run Database Schema

1. Go to Supabase Dashboard
2. Click **SQL Editor** (left menu)
3. Click **"New query"**
4. Copy entire contents of `database/schema.sql`
5. Paste and click **"Run"**
6. You should see: ✅ **Success. No rows returned**

---

## ✅ Step 3: Install Dependencies

### Backend:
```bash
pip install -r requirements.txt
```

### Frontend:
```bash
cd frontend
npm install
```

---

## ✅ Step 4: Start Development Servers

### Backend:
```bash
uvicorn main:app --reload
```

Should see:
```
✅ Supabase client initialized successfully
✅ Google AI configured successfully
✅ Content router registered
✅ Scheduling router registered
✅ Auth router registered
✅ Accounts router registered
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Frontend (in new terminal):
```bash
cd frontend
npm run dev
```

Should see:
```
  VITE v5.0.12  ready in 500 ms

  ➜  Local:   http://localhost:5173/
```

---

## ✅ Step 5: Test the Application

### 1. Open Browser
Go to: http://localhost:5173

You should be redirected to: http://localhost:5173/login

### 2. Sign Up
- Click **"Sign up"**
- Enter email, password, full name
- Click **"Create Account"**

### 3. After Signup
- You'll be automatically logged in
- A default account is created for you
- You'll see the main app with:
  - **Account Switcher** in header (to switch between accounts)
  - **User Menu** in header (Settings, Logout)

### 4. Generate Content
- Enter URL (e.g., https://www.apple.com/)
- Add keywords
- Select platforms
- Click **"Generate Content"**

### 5. Schedule a Post
- After generation, click **"Schedule Post"**
- Choose "Post Now" or "Schedule for Later"
- If scheduling, pick date & time
- Click **"Schedule Post"**

### 6. Check Database
Go to Supabase Dashboard → Table Editor:
- `accounts` - should have 1 account
- `scheduled_posts` - should have your scheduled post

---

## 🐛 Troubleshooting

### Backend won't start
- Check `.env` has correct SUPABASE credentials
- Check JWT_SECRET is the real one (not Key ID)
- Run: `pip install -r requirements.txt`

### Frontend won't start
- Check `frontend/.env` exists
- Run: `cd frontend && npm install`

### "JWT expired" error
- JWT Secret is wrong
- Go to Supabase Settings → API → JWT Settings
- Copy the real JWT Secret (long string)

### "Supabase client not initialized"
- SUPABASE_URL or SUPABASE_SERVICE_KEY is wrong
- Check Settings → API for correct values

### Can't login/signup
- Check browser console for errors
- Backend should show: `✅ Auth router registered`
- Check Supabase Auth is enabled (Authentication → Providers → Email)

---

## 🚀 Deploy to Production

### Backend (Railway)
Add these environment variables:
```
GOOGLE_AI_API_KEY=your_key
SUPABASE_URL=https://zginpuizzwalrvyxrrmw.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_Ow6UY8N9OJvEEUhNAnszMw_wNfIY_66
JWT_SECRET=your-real-jwt-secret-here
```

### Frontend (Vercel)
Add these environment variables:
```
VITE_API_URL=https://your-railway-app.railway.app
VITE_SUPABASE_URL=https://zginpuizzwalrvyxrrmw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_dYUaqBdMdGUDPbllFbNVfQ_bzbFK7ES
```

---

## 📚 Next Steps

- [ ] Get real JWT Secret from Supabase
- [ ] Run database schema
- [ ] Test signup/login
- [ ] Generate first post
- [ ] Schedule first post
- [ ] Check Supabase database

**Need help? Check `SUPABASE_SETUP.md` for detailed instructions!**
