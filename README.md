# Social Media Automation Tool

AI-powered tool for generating and scheduling social media content with multi-account management, team collaboration, and automatic publishing.

---

## 📋 Features Implemented

✅ **Multi-language** (English, Hebrew, Spanish, Portuguese)  
✅ **Post Editing** (regenerate text/images, AI editing)  
✅ **Scheduling** (calendar, auto-publish, recurring posts)  
✅ **Multi-Account** (switch between business accounts)  
✅ **Social Media APIs** (Facebook, Instagram, LinkedIn, Twitter, TikTok)  
✅ **Product Library** (upload, categorize, search products)  
✅ **Person Images** (upload reference photos for consistent generation)  
✅ **Image Overlay Editor** (add text, shapes, arrows for real estate/promo)  
✅ **Design References** (save & reuse styles)  
✅ **Team Permissions** (admin/manager/creator roles)  
✅ **Video Translation** (auto-dub videos into multiple languages via ElevenLabs)  
✅ **AI Chat with Function Calling** (Gemini AI can execute real actions - create campaigns, analyze data, generate content)  
✅ **Google Ads Integration** (OAuth, campaign management, RSA creation, performance analytics)  

---

## 🚀 Step-by-Step Setup Guide

### STEP 1: Supabase (Database Setup)

1. Go to [supabase.com](https://supabase.com) → Sign up
2. **New Project**:
   - Name: `social-media-automation`
   - Password: (save it!)
   - Region: closest to your users
3. **SQL Editor** → New Query → copy entire `database/schema.sql` file → RUN
4. **Storage** → Create 4 buckets:
   - `products` (public) - for product photos
   - `persons` (private) - for person reference photos
   - `designs` (private) - for design references
   - `generated-images` (public) - for AI-generated images
5. **Settings** → **API** → copy:
   - Project URL: `https://xxx.supabase.co`
   - anon public key: `eyJhbGc...`

---

### STEP 2: Railway (Backend Deployment)

1. Go to [railway.app](https://railway.app) → Login with GitHub
2. **New Project** → Deploy from GitHub repo
3. Select this repository
4. **Variables** → Add:
   ```
   GOOGLE_AI_API_KEY=your_gemini_api_key
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_KEY=your_supabase_anon_key
   ```
5. Railway will automatically deploy the backend
6. Copy the URL: `https://your-project.railway.app`
7. Test it: open `https://your-project.railway.app/health` → should return `{"status":"healthy"}`

---

### STEP 3: Frontend Setup

1. Create `frontend/.env` file:
   ```
   VITE_API_URL=https://your-project.railway.app
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. Dependencies are already installed! ✅
   - `@supabase/supabase-js` - for authentication
   - `react-router-dom` - for routing
   - Basic frontend already works

3. Run locally:
   ```bash
   cd frontend
   npm run dev
   ```
   Opens at `http://localhost:5173`

4. Deploy to Vercel:
   ```bash
   npm run build
   npx vercel --prod
   ```

**Frontend Features Already Implemented:**
- ✅ Auth (Login/Signup) - pages created
- ✅ Account Switcher - ready
- ✅ User Menu - ready
- ✅ Basic content generation - working
- ✅ Multi-language - working

---

### STEP 4: Facebook & Instagram API (Optional)

For auto-posting you need:

1. **Facebook App**:
   - [developers.facebook.com](https://developers.facebook.com) → Create App
   - Type: Business
   - Add products: Facebook Login + Instagram Graph API
   - Settings → Basic → copy App ID and App Secret

2. **Facebook Business Manager**:
   - [business.facebook.com](https://business.facebook.com)
   - Add Facebook page
   - Connect Instagram Business account

3. **OAuth Flow**:
   - User logs in via Facebook
   - Grants access to pages
   - Token saved to `social_connections` table

4. **Testing**:
   - Schedule a post
   - Scheduler will auto-publish at scheduled time

---

### STEP 5: ElevenLabs Video Translation (Optional)

🎬 **New Feature:** Automatically dub videos into multiple languages!

**Why Priority:**
- 🇮🇱 **Hebrew (Alpha)** - API-only access (not in ElevenLabs UI!)
- One video → multiple markets automatically
- Competitive advantage

**Setup:**
1. Go to [elevenlabs.io](https://elevenlabs.io) → Sign up
2. Settings → API Keys → Generate API Key
3. Add to Railway environment variables:
   ```
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   ```

**Supported Languages:**
- Hebrew (עברית) - **Alpha API access**
- Spanish (Español)
- French (Français)
- Portuguese (Português)

**How to Use:**
1. Click "🎬 Video Translation" tab
2. Upload video (max 500MB)
3. Select target languages
4. Click "Start Translation"
5. Wait ~5 minutes per language
6. Download dubbed videos

---

### STEP 6: LinkedIn / Twitter / TikTok (Optional)

- **LinkedIn**: [linkedin.com/developers](https://www.linkedin.com/developers/) → Create app
- **Twitter**: [developer.twitter.com](https://developer.twitter.com/) → Apply for access
- **TikTok**: [developers.tiktok.com](https://developers.tiktok.com/) → Business API

For each platform:
1. Create App
2. Setup OAuth
3. Get Access Token
4. Save to `social_connections` via UI

---

## 🤖 AI Chat with Function Calling

**NEW:** Gemini AI can now **execute real actions**, not just talk!

### What is Function Calling?

**Before (Regular Chat):**
```
User: "Show me my Google Ads campaigns"
AI: "I can't access your campaigns, but here's how you can check them..."
```

**After (With Function Calling):**
```
User: "Show me my Google Ads campaigns"
AI: [CALLS] get_google_ads_campaigns(date_range="LAST_30_DAYS")
     [EXECUTES] → Pulls real data from Google Ads API
     [RESPONDS] "You have 5 campaigns. Here's the breakdown:
                 - Campaign A: $1,200 spend, 3.2% CTR, 450 clicks
                 - Campaign B: $850 spend, 2.1% CTR, 280 clicks..."
```

### Available Functions

**Google Ads:**
- `get_google_ads_campaigns` - Pull campaign data with metrics
- `get_google_ads_connection_status` - Check if connected
- `create_google_ads_rsa` - Create Responsive Search Ad
- `generate_google_ads_content` - AI-generate ad headlines & descriptions
- `analyze_campaign_performance` - Get insights & recommendations

**Content Generation:**
- `generate_social_media_posts` - Create posts for Instagram/Facebook/LinkedIn/Twitter/TikTok

**Scheduling:**
- `get_scheduled_posts` - View scheduled posts calendar

**Social Connections:**
- `get_social_connections_status` - Check which accounts are connected

### How It Works

1. **User sends message** → "Analyze my Google Ads performance"
2. **AI decides which function to call** → `get_google_ads_campaigns` + `analyze_campaign_performance`
3. **Backend executes functions** → Pulls real data from Google Ads API
4. **AI receives results** → Gets campaign metrics, spend, CTR, etc.
5. **AI responds with insights** → "Your top campaign is X with 4.2% CTR. I recommend increasing budget by 20%..."

### Conversation Memory

**Enhanced context tracking:**
- Remembers last 50 messages (up from 20)
- Stores function call results in history
- AI knows what actions it performed
- Can reference previous data in follow-up questions

**Example:**
```
User: "Create a campaign for my product"
AI: [CALLS] generate_google_ads_content(...) → Creates headlines/descriptions
     "✅ Created ad content. Ready to publish?"

User: "Yes, create it"
AI: [CALLS] create_google_ads_rsa(...) → Creates actual campaign
     [REMEMBERS campaign ID from previous step]
     "✅ Campaign created! ID: 123456"

User: "How's it performing?"
AI: [CALLS] analyze_campaign_performance(campaign_ids=["123456"])
     [REMEMBERS the campaign ID from 2 messages ago]
     "Your campaign has 1,500 impressions and 3.5% CTR so far"
```

### Real-World Usage Examples

**1. Campaign Analysis:**
```
User: "What's my best performing campaign?"
AI: → Pulls data, analyzes CTR/conversions/ROAS
    → "Campaign X has the best ROAS at 4.2x. It's spending $200/day 
       and generating $840 in revenue."
```

**2. Ad Creation Workflow:**
```
User: "Create ads for my new product at example.com"
AI: → Scrapes website
    → Generates 15 headlines + 4 descriptions
    → Shows preview
    → "Ready to create? Which ad group?"
User: "Ad group 987654"
AI: → Creates RSA in Google Ads
    → "✅ Created and set to PAUSED for review"
```

**3. Multi-Platform Strategy:**
```
User: "Create social posts for my product launch"
AI: → Generates Instagram, Facebook, LinkedIn, Twitter posts
    → Different tones per platform
    → Includes images
    → "Created 4 variations for each platform. Want to schedule?"
```

### Technical Implementation

**Files:**
- `services/chat_tools.py` - Function declarations (10+ tools)
- `services/function_executor.py` - Executes functions called by AI
- `routers/chats.py` - Multi-turn function calling loop

**Architecture:**
```
User Message
    ↓
Gemini AI (decides to call function)
    ↓
FunctionExecutor (executes via API)
    ↓
Result returned to Gemini
    ↓
Gemini analyzes result
    ↓
Response to user (with real data!)
```

**Safety Features:**
- Max 5 function calls per message (prevents loops)
- Error handling for API failures
- Connection checks before operations
- All results saved to chat history

### Setup Requirements

**Already working if you have:**
- ✅ Google Ads connected (via Settings > Connections)
- ✅ `GOOGLE_AI_API_KEY` in environment variables
- ✅ Backend deployed

**Chat endpoint:** `POST /api/chats/{chat_id}/message`

---

## 🗄️ Database Tables

After running `database/schema.sql` in Supabase, these tables are created:

- `accounts` - business accounts
- `social_connections` - API tokens for Facebook/Instagram/etc
- `scheduled_posts` - scheduled posts
- `post_history` - published posts + analytics
- `products` - product library
- `person_images` - person photos for generation
- `design_references` - design references
- `content_templates` - text templates
- `team_members` - team + permissions

---

## 🔌 API Endpoints

**Auth:**
- `POST /api/auth/signup` - register
- `POST /api/auth/login` - login
- `POST /api/auth/logout` - logout

**Accounts:**
- `GET /api/accounts` - list accounts
- `POST /api/accounts` - create account
- `PATCH /api/accounts/{id}` - update

**Content:**
- `POST /api/generate` - generate content (works without auth)
- `POST /api/content/regenerate-text` - regenerate text
- `POST /api/content/regenerate-image` - regenerate image
- `POST /api/content/edit-text` - edit text (shorten, add_emojis, etc)

**Scheduling:**
- `POST /api/scheduling/schedule` - schedule post
- `GET /api/scheduling/posts` - list scheduled posts
- `GET /api/scheduling/calendar` - calendar view

**Products:**
- `POST /api/products/upload` - upload photo
- `POST /api/products` - create product
- `GET /api/products` - list (search, filters)

**Persons:**
- `POST /api/persons/upload` - upload person photos
- `POST /api/persons` - create person
- `GET /api/persons` - list

**Designs:**
- `POST /api/designs/upload` - upload reference
- `POST /api/designs/analyze-style` - AI style analysis
- `GET /api/designs` - list

**Image Editor:**
- `POST /api/image-editor/edit` - add text, shapes, arrows
- `GET /api/image-editor/presets` - presets (real estate, promo)

**Team:**
- `POST /api/team/{account_id}/invite` - invite to team
- `GET /api/team/{account_id}/members` - list team
- `PATCH /api/team/{account_id}/members/{id}` - change permissions

**Video Translation:**
- `POST /api/video/translate` - upload & translate video
- `GET /api/video/status/{job_id}` - check translation status
- `GET /api/video/jobs` - list all translation jobs
- `DELETE /api/video/job/{job_id}` - cancel job
- `GET /api/video/health` - check ElevenLabs API status

**AI Chat (with Function Calling):**
- `POST /api/chats/create` - create new chat
- `GET /api/chats/list` - list all chats
- `GET /api/chats/{chat_id}/messages` - get chat history
- `POST /api/chats/{chat_id}/message` - send message (AI responds with function calls)
- `DELETE /api/chats/{chat_id}` - delete chat

**Google Ads:**
- `GET /api/google-ads/oauth/authorize` - start OAuth flow
- `GET /api/google-ads/oauth/callback` - handle OAuth redirect
- `POST /api/google-ads/oauth/complete` - complete connection
- `GET /api/google-ads/campaigns` - list campaigns with metrics
- `GET /api/google-ads/ad-groups/{campaign_id}` - list ad groups
- `POST /api/google-ads/create-rsa` - create Responsive Search Ad
- `POST /api/google-ads/add-sitelinks` - add sitelink extensions
- `GET /api/google-ads/status` - check connection status
- `DELETE /api/google-ads/disconnect` - disconnect account

---

## 🎯 What's Already Working

✅ **Backend fully ready** (all API endpoints implemented)

✅ **Frontend core features:**
- Content generation
- Multi-language (en, he, ru)
- Dark theme
- Responsive design

✅ **Auth system created:**
- Login/Signup pages
- AuthContext
- AccountContext
- UserMenu
- AccountSwitcher

✅ **AI Intelligence:**
- Function calling with Gemini AI
- 10+ executable functions
- Multi-turn conversations
- Conversation memory (50 messages)
- Real-time data access

✅ **Google Ads Integration:**
- Automatic OAuth flow
- Campaign listing with metrics
- RSA ad creation
- Performance analytics
- AI-powered recommendations

---

## 📝 Optional Features to Add

For full functionality, you can add:
1. **Scheduling UI** (calendar, date picker)
2. **Product Library UI** (upload, grid)
3. **Image Overlay Editor** (canvas editor)
4. **Team Management UI** (team list, permissions)

But **basic content generation already works!**

---

## 🔐 Security

- All passwords hashed by Supabase Auth
- JWT tokens for API auth
- RLS (Row Level Security) - users only see their own data
- Social media tokens stored encrypted
- File upload validation (type, size)

---

## 💰 Monthly Costs

- Supabase Free: 500MB DB, 1GB storage - **$0**
- Railway: ~$5-20 (traffic-based)
- Vercel: Free for hobby
- Google Gemini API: ~$0.01-0.10 per post
- ElevenLabs: ~$0.50-2 per minute of video (optional)

**Total: $5-30/month** (without video translation)  
**With video: +$10-50/month** (depending on usage)

---

## ❓ Troubleshooting

### Backend not starting
```bash
cd backend
pip install -r requirements.txt
python main.py
# Check http://localhost:8000/health
```

### Frontend can't reach API
- Check `frontend/.env` → `VITE_API_URL`
- Check CORS in `main.py`

### Supabase error
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Did you run schema.sql?

### Posts not publishing
- Check tokens in `social_connections` table
- Facebook token expires after 60 days (needs refresh)
- Is scheduler running? (check Railway logs for "Scheduler started")

---

## 📞 Support & Docs

- **Supabase docs**: https://supabase.com/docs
- **Gemini API**: https://ai.google.dev/docs
- **Meta API**: https://developers.facebook.com/docs
- **ElevenLabs API**: https://elevenlabs.io/docs
- **Railway**: https://docs.railway.app

---

## ✅ Setup Checklist

- [ ] Supabase project created + schema run
- [ ] Railway backend deployed + env vars configured
- [ ] Frontend `.env` configured
- [ ] Supabase client working (`lib/supabase.ts`)
- [ ] AuthContext working
- [ ] Login/Signup pages created
- [ ] Account Switcher added
- [ ] Language selector working
- [ ] First post successfully generated!
- [ ] Google Ads connected (optional)
- [ ] AI Chat tested with function calling (optional)
- [ ] Facebook App created (optional)
- [ ] Post scheduled and auto-published (optional)

---

## 🎉 Summary

**Backend:** 13 routers (including AI Chat + Google Ads), 12 database tables, full API  
**Frontend:** Auth, multi-account, content generation, video translation, Google Ads  
**AI:** Function calling with 10+ tools, conversation memory, real-time data access  
**Integrations:** Google Ads API, Meta APIs, LinkedIn, Twitter, TikTok, ElevenLabs  
**Status:** Ready to use! 🚀

Deploy and start generating social media content in 4 languages + auto-dub videos + AI-powered Google Ads management with natural language!
