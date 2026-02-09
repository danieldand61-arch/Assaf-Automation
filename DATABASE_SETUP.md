# Database Setup Guide

Complete guide to set up Joyo Marketing database on Supabase.

## 🚀 Quick Start

1. Go to Supabase SQL Editor
2. Run migrations in order (numbered files)
3. Verify tables and functions created

## 📋 Required Migrations (in order)

### 1. Main Schema
**File:** `database/schema.sql`
**Creates:**
- `accounts` - Business accounts
- `user_settings` - User preferences
- `account_connections` - Social media connections
- `content_history` - Generated content log
- `scheduled_posts` - Post scheduling
- `chat_messages` - AI chat history
- `chats` - Chat sessions

### 2. Add Accounts Metadata
**File:** `database/migrations/add_accounts_metadata.sql`
**Purpose:** Add metadata JSONB column for extended onboarding data
**Creates:** `accounts.metadata` column

### 3. Saved Posts Table
**File:** `database/migrations/create_saved_posts_table.sql`
**Creates:** `saved_posts` table for library

### 4. Chat System
**File:** `database/add_chat_system.sql`
**Creates:** `chats` and `chat_messages` tables

### 5. Google Ads Connections
**File:** `database/google_ads_connections.sql`
**Creates:** `google_ads_connections` table for OAuth

### 6. Auto Account Creation
**File:** `database/auto_create_account_trigger.sql`
**Purpose:** Automatically create default account on user signup
**Creates:** Trigger function

### 7. Credits System
**File:** `database/migrations/create_credits_system.sql`
**Creates:**
- `user_credits` - User credits balance
- `credits_usage` - Usage log
- Auto-update trigger for balance

### 8. Admin Stats Function
**File:** `database/migrations/create_admin_stats_function.sql`
**Creates:** `get_users_credits_stats()` function for admin dashboard

## ⚙️ Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor
```
1. Go to https://supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
```

### Step 2: Run Main Schema
```sql
-- Copy and paste contents of database/schema.sql
-- Click "Run" or press Cmd/Ctrl+Enter
-- Verify: should see "Success. No rows returned"
```

### Step 3: Run Migrations
Run each migration file in order:

```sql
-- 1. Add metadata to accounts
-- Paste: database/migrations/add_accounts_metadata.sql

-- 2. Create saved posts
-- Paste: database/migrations/create_saved_posts_table.sql

-- 3. Add chat system
-- Paste: database/add_chat_system.sql

-- 4. Google Ads connections
-- Paste: database/google_ads_connections.sql

-- 5. Auto account trigger
-- Paste: database/auto_create_account_trigger.sql

-- 6. Credits system
-- Paste: database/migrations/create_credits_system.sql

-- 7. Admin stats function
-- Paste: database/migrations/create_admin_stats_function.sql
```

### Step 4: Verify Tables Created
```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- accounts
-- account_connections
-- chat_messages
-- chats
-- content_history
-- credits_usage
-- google_ads_connections
-- saved_posts
-- scheduled_posts
-- user_credits
-- user_settings
```

### Step 5: Verify Functions Created
```sql
-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Expected functions:
-- auto_create_default_account
-- get_users_credits_stats
-- update_user_credits_balance
```

## 🔒 Security & RLS (Row Level Security)

The application uses Supabase Auth middleware for security. RLS policies are recommended for production:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON credits_usage
    FOR SELECT USING (auth.uid() = user_id);
```

## 🧪 Testing

### Test Accounts Table
```sql
SELECT * FROM accounts LIMIT 5;
```

### Test Credits System
```sql
-- Check credits balance
SELECT * FROM user_credits;

-- Check usage log
SELECT * FROM credits_usage ORDER BY created_at DESC LIMIT 10;
```

### Test Admin Function
```sql
SELECT * FROM get_users_credits_stats();
```

## 🐛 Troubleshooting

### Issue: "relation does not exist"
**Solution:** Run `database/schema.sql` first

### Issue: "function does not exist"
**Solution:** Run migration files in order

### Issue: "permission denied"
**Solution:** Supabase admin has full access, this shouldn't happen

### Issue: Admin function returns no data
**Solution:** 
1. Check if `auth.users` table exists (it's built-in)
2. Verify users are registered
3. Check if `user_credits` table has data

## 📊 Database Diagram

```
auth.users (Supabase built-in)
    ↓
user_settings (preferences, active_account)
    ↓
accounts (business accounts)
    ↓
├─ account_connections (social media OAuth)
├─ content_history (generated posts)
├─ scheduled_posts (scheduled content)
├─ chats (AI chat sessions)
│   └─ chat_messages (chat history)
├─ saved_posts (library)
└─ google_ads_connections (Google Ads OAuth)

user_credits (balance)
    ↑
credits_usage (usage log) → auto-updates balance
```

## 🔄 Auto-Migrations

Some tables auto-update:
- `user_credits.credits_remaining` - Updates after each `credits_usage` insert
- Default account - Created automatically on user signup
- Timestamps - `updated_at` auto-updates (add trigger if needed)

## 💾 Backup

Supabase automatically backs up your database. For manual backup:

```sql
-- Export all data
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

## 🎯 Next Steps

After running migrations:
1. Test user registration → should auto-create account
2. Send a chat message → should track credits
3. Check admin dashboard → should show users
4. Generate content → should log usage

All migrations are idempotent (safe to run multiple times).
