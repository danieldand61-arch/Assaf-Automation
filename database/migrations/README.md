# Database Migrations

## How to run migrations

### Option 1: Via Supabase Dashboard
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy the contents of the migration file
4. Paste and execute

### Option 2: Via psql
```bash
psql "$DATABASE_URL" < fix_video_dubbing_bytes_to_credits.sql
```

## Migration: fix_video_dubbing_bytes_to_credits.sql

**Purpose:** Convert old video_dubbing records from bytes to credits

**What it does:**
- Finds all `video_dubbing` records where `total_tokens > 10000` (likely bytes)
- Converts bytes to credits using formula: `credits = bytes / (1024 * 1024 * 3)` (~1 credit per 3MB)
- Marks records as migrated
- Preserves original byte count in metadata

**When to run:** 
Run this once after deploying the new credits tracking system.

**Example:**
- Old: 711296 bytes
- New: 1 credit (711296 / 1024 / 1024 / 3 ≈ 0.23 MB ≈ 1 credit)
