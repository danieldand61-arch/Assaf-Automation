# 🗄️ Supabase Setup Guide

This guide will help you set up Supabase for the Social Media Automation Tool.

---

## 📋 Prerequisites

- A Supabase account (free tier works fine)
- Basic understanding of PostgreSQL

---

## 🚀 Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `social-media-automation` (or any name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for setup

---

## 🔑 Step 2: Get API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:

```bash
# Project URL
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon/Public Key (safe for frontend)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (NEVER expose to frontend!)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Step 3: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `database/schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** (bottom right)
6. You should see: ✅ **Success. No rows returned**

This creates:
- ✅ 10 tables (accounts, scheduled_posts, products, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Indexes for performance
- ✅ Triggers for auto-updating timestamps

---

## 🔐 Step 4: Configure Authentication

### Enable Email/Password Auth

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure settings:
   - ✅ **Enable email confirmations** (optional, recommended for production)
   - ✅ **Enable email change confirmations**
   - ✅ **Secure email change**

### (Optional) Enable OAuth Providers

For social login (Google, GitHub, etc.):

1. Go to **Authentication** → **Providers**
2. Enable providers you want (e.g., Google)
3. Follow provider-specific setup instructions

---

## 📁 Step 5: Configure Storage

For storing images (logos, product photos, etc.):

1. Go to **Storage** → **Policies**
2. Create a new bucket:
   - **Name**: `post-images`
   - **Public**: ✅ Yes (for social media images)
3. Add storage policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- Allow public read access
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Users can update their own images
CREATE POLICY "Users can update their images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'post-images' AND owner = auth.uid());

-- Users can delete their own images
CREATE POLICY "Users can delete their images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-images' AND owner = auth.uid());
```

---

## 🔧 Step 6: Configure Environment Variables

### Backend (.env)

Create/update `.env` file:

```bash
# Google AI
GOOGLE_AI_API_KEY=your_google_ai_key_here

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT Secret (from Supabase Settings → API → JWT Secret)
JWT_SECRET=your-jwt-secret-from-supabase

# App Settings
ENVIRONMENT=development
PORT=8000
```

### Frontend (.env)

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Railway (Production)

Add these environment variables in Railway dashboard:

```
GOOGLE_AI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
```

### Vercel (Frontend Production)

Add these environment variables in Vercel dashboard:

```
VITE_API_URL=https://your-railway-app.railway.app
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## ✅ Step 7: Verify Setup

### Test Database Connection

Run this SQL query in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- accounts
- account_connections
- scheduled_posts
- products
- persons
- design_references
- team_members
- team_invitations
- user_settings
- post_history

### Test Authentication

1. Start your backend: `uvicorn main:app --reload`
2. Start your frontend: `cd frontend && npm run dev`
3. Try to register a new user
4. Check Supabase **Authentication** → **Users** to see the new user

---

## 🔒 Security Best Practices

### ⚠️ NEVER expose Service Role Key!

- ❌ Don't commit to Git
- ❌ Don't use in frontend
- ✅ Only use in backend
- ✅ Store in environment variables

### Enable RLS (Row Level Security)

Already enabled in `schema.sql`, but verify:

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`.

### Use Anon Key in Frontend

- ✅ Safe to expose (limited permissions)
- ✅ RLS policies protect data
- ✅ Users can only access their own data

---

## 🐛 Troubleshooting

### "relation does not exist" error

- Run `database/schema.sql` again
- Make sure you're in the correct project

### "JWT expired" error

- Refresh token expired
- User needs to log in again
- Check token expiration settings in Supabase

### "permission denied for table" error

- RLS policies not set correctly
- Re-run RLS policy section of `schema.sql`

### Storage upload fails

- Check storage policies are set
- Verify bucket name matches code
- Check file size limits (default: 50MB)

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

---

## 🎉 Next Steps

Once Supabase is set up:

1. ✅ Test user registration/login
2. ✅ Create a business account
3. ✅ Connect social media platforms
4. ✅ Schedule your first post!

---

**Need help?** Check the troubleshooting section or contact support.
