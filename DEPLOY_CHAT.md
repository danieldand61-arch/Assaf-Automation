# Workspace System Deployment Instructions

## 1. Database Setup (Supabase)

### Step 1: Run the SQL migration
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open the file `database/add_chat_system.sql`
4. Copy all the SQL and run it in the SQL Editor
5. Verify that the following tables were created:
   - `chats` (workspaces)
   - `chat_messages` (action logs)
   - `saved_posts` (if not already exists)

### Step 2: Verify the schema
Run this query to check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('chats', 'chat_messages', 'saved_posts');
```

## 2. Backend Setup

### Step 1: Install dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Test locally
```bash
python -m uvicorn main:app --reload
```

Test endpoints:
- GET  `/api/chats/list` - List all workspaces
- POST `/api/chats/create` - Create new workspace
- GET  `/api/chats/{chat_id}/messages` - Get action history
- POST `/api/chats/{chat_id}/action` - Log action
- DELETE `/api/chats/{chat_id}` - Delete workspace

## 3. Frontend Setup

### Step 1: Install dependencies (if needed)
```bash
cd frontend
npm install
```

### Step 2: Test locally
```bash
npm run dev
```

### Step 3: Build for production
```bash
npm run build
```

## 4. Deploy

### Railway (Backend)
1. Push changes to GitHub
2. Railway will automatically detect changes and redeploy
3. Verify deployment logs
4. Add `ANTHROPIC_API_KEY` to Railway environment variables

### Vercel (Frontend)
1. Push changes to GitHub
2. Vercel will automatically detect changes and redeploy
3. Verify deployment logs

## 5. Post-Deployment Testing

1. Open your application
2. You should see the new workspace interface on the homepage
3. Try creating a new workspace
4. Test "Generate Post" button
5. Test "AI Dubbing" button
6. Verify workspaces are saved
7. Test creating multiple workspaces
8. Test deleting a workspace

## 6. Troubleshooting

### If workspaces don't load:
- Check browser console for errors
- Verify Supabase connection
- Check API logs in Railway

### If features don't open:
- Check browser console for errors
- Verify frontend build is latest
- Check component imports

### If database errors:
- Check that SQL migration ran successfully
- Verify RLS policies are enabled
- Check Supabase logs

## Notes

- The old App interface is still available at `/old` if needed
- Workspaces are project containers for organizing work
- All workspaces are saved per user
- Features (Post Generation, Video Dubbing) open inline within the workspace
- Action history is logged in each workspace
