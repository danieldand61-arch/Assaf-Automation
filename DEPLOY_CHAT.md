# Chat System Deployment Instructions

## 1. Database Setup (Supabase)

### Step 1: Run the SQL migration
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open the file `database/add_chat_system.sql`
4. Copy all the SQL and run it in the SQL Editor
5. Verify that the following tables were created:
   - `chats`
   - `chat_messages`
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

### Step 1: Add environment variables
Add to your `.env` file (and Railway/Vercel environment variables):
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

To get an Anthropic API key:
1. Go to https://console.anthropic.com/
2. Create an account or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy it to your environment variables

### Step 2: Install dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Test locally
```bash
python -m uvicorn main:app --reload
```

Test endpoints:
- GET  `/api/chats/list` - List all chats
- POST `/api/chats/create` - Create new chat
- GET  `/api/chats/{chat_id}/messages` - Get messages
- POST `/api/chats/{chat_id}/message` - Send message
- DELETE `/api/chats/{chat_id}` - Delete chat

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
2. You should see the new chat interface on the homepage
3. Try creating a new chat
4. Send a message to the AI
5. Test "Generate Post" button
6. Test "AI Dubbing" button
7. Verify chat history is saved
8. Test creating multiple chats
9. Test deleting a chat

## 6. Troubleshooting

### If chats don't load:
- Check browser console for errors
- Verify Supabase connection
- Check API logs in Railway

### If AI doesn't respond:
- Verify ANTHROPIC_API_KEY is set
- Check API logs for errors
- Verify you have credits in Anthropic account

### If database errors:
- Check that SQL migration ran successfully
- Verify RLS policies are enabled
- Check Supabase logs

## Notes

- The old App interface is still available at `/old` if needed
- Chat system uses Claude 3.5 Sonnet model
- All chats and messages are saved per user
- Features (Post Generation, Video Dubbing) open inline within the chat
- Chat history includes action results (generated posts, videos, etc.)
