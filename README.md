# Social Media Automation & Ad Creation System

A powerful, user-friendly platform that takes a website URL and keywords, then automatically creates professional social media posts with eye-catching AI-generated images for Facebook and Instagram.

## 🚀 Features (Phase 1)

- **Smart Website Analysis**: Automatically extracts brand information, colors, logo, and tone
- **AI Content Generation**: Gemini 2.5 Pro creates 4 unique post variations for each platform
- **AI Image Generation**: Nano Banana 🍌 (Gemini 2.5 Flash Image) generates high-quality images
- **Multi-Platform Support**: Facebook & Instagram with platform-specific optimizations
- **Smart Hashtags**: Auto-generates trending and relevant hashtags
- **Engagement Score**: Predicts post performance likelihood
- **Live Preview**: See how posts will look on each platform
- **Multiple Sizes**: Square 1024x1024 optimized for all platforms
- **🌐 Bilingual Interface**: Full support for English & Hebrew (עברית) with RTL
- **🌓 Dark/Light Theme**: Seamless theme switching with proper contrast for both modes
- **✨ Modern UI**: Professional design with Heebo font for Hebrew and Inter for English

## 📋 Requirements

- Python 3.10+
- Node.js 18+
- Google AI API Key from Google AI Studio

## 🛠️ Installation

### Windows (PowerShell):
```powershell
.\install.ps1
```

### Mac/Linux (Manual):
```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## ⚙️ Configuration

1. Get an API key from https://aistudio.google.com/apikey
2. Create `backend/.env` file:
```env
GOOGLE_AI_API_KEY=AIzaSy...xxxxxxxxxxxxx
```

## 🚀 Running the Application

### Windows (PowerShell):
```powershell
.\start.ps1
```

### Mac/Linux (Manual):

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate
python main.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Access the App

Open **http://localhost:3000** in your browser

Backend API: **http://localhost:8000**

## 🎯 How to Use

1. **Choose your language**: Toggle between English (EN) and Hebrew (עב) in the header
2. **Switch theme**: Click the sun/moon icon to toggle between light and dark mode
3. Enter a website URL (e.g., `https://apple.com`)
4. Add keywords/description (e.g., `new iPhone, innovation, technology`)
5. Select platforms (Facebook, Instagram, or both)
6. Choose style (Professional, Casual, Funny, etc.)
7. Select target audience
8. Enter industry
9. Toggle emojis and logo options
10. Click "Generate Content"
11. Wait 30-60 seconds for AI generation
12. Review 4 post variations with images
13. Download all content as ZIP

**Note**: Language and theme preferences are saved locally in your browser!

## 📁 Project Structure

```
AssafAutomation/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # API entry point
│   ├── services/
│   │   ├── scraper.py      # Website scraping
│   │   ├── content_generator.py  # GPT-4 text generation
│   │   └── image_generator.py    # DALL-E 3 image generation
│   └── requirements.txt
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── components/    # UI components
│   │   └── store/         # State management (Zustand)
│   └── package.json
│
└── README.md
```

## 🔧 API Reference

### `POST /api/generate`

Generates social media content.

**Request:**
```json
{
  "url": "https://example.com",
  "keywords": "product launch, innovation",
  "platforms": ["facebook", "instagram"],
  "style": "professional",
  "target_audience": "b2c",
  "industry": "technology",
  "include_emojis": true,
  "include_logo": false
}
```

**Response:**
```json
{
  "variations": [
    {
      "text": "Post text...",
      "hashtags": ["tag1", "tag2"],
      "char_count": 250,
      "engagement_score": 0.85,
      "call_to_action": "Learn more!"
    }
  ],
  "images": [
    {
      "url": "https://...",
      "size": "instagram_square",
      "dimensions": "1080x1080"
    }
  ],
  "brand_colors": ["#1877f2", "#000000"],
  "brand_voice": "professional"
}
```

## 💰 Cost Estimate

**Per generation (~4 posts + 3 images):**
- Gemini 2.5 Pro (text): ~$0.01-0.02
- Nano Banana (images): ~$0.12
- **Total: ~$0.13-0.14**
- **70% cheaper than OpenAI GPT-4 + DALL-E!**

## 🎨 Tech Stack

**Backend:**
- FastAPI (async Python web framework)
- Google Gemini 2.5 Pro (text generation)
- Nano Banana 🍌 (Gemini 2.5 Flash Image for images)
- BeautifulSoup4 (web scraping)
- httpx (async HTTP)
- Pillow (image processing)

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS (with dark mode support)
- Zustand (state management)
- Lucide React (icons)
- i18n (English/Hebrew support with RTL)
- Google Fonts (Inter + Heebo)

## 🐛 Troubleshooting

### Backend won't start
- Check Python version: `python --version` (needs 3.10+)
- Install dependencies: `pip install -r requirements.txt`
- Verify port 8000 is available

### Frontend won't start
- Check Node version: `node --version` (needs 18+)
- Reinstall: `rm -rf node_modules && npm install`
- Verify port 3000 is available

### "Google AI API key not found"
- Ensure `.env` file exists in `backend/` directory
- Verify API key is valid and active
- Get key at https://aistudio.google.com/apikey

### CORS errors
- Ensure backend is running on port 8000
- Check CORS middleware in `main.py`

## 📈 Roadmap

### Phase 1: ✅ COMPLETE
- Smart content generation
- Multi-platform support
- AI images
- Preview system
- Bilingual interface (EN/HE)
- Dark/light theme
- RTL support

### Phase 2: 🚧 PLANNED
- Direct publishing to Facebook/Instagram
- Content scheduler
- Analytics dashboard
- User authentication
- Saved templates library

### Phase 3: 💡 FUTURE
- A/B testing
- Team collaboration
- White-label options
- API for 3rd parties

## 🚀 Production Deployment

### Quick Deploy Guide

**Recommended setup:**
- Frontend → **Vercel** (free, optimized for React)
- Backend → **Railway** ($5/month, perfect for FastAPI + AI)

### Backend (Railway):
1. Go to https://railway.app/new
2. Deploy from GitHub → select this repo
3. Add env variable: `GOOGLE_AI_API_KEY=AIzaSy...xxxxx`
4. Copy your Railway URL

### Frontend (Vercel):
1. Go to https://vercel.com/new
2. Import this repo → select `frontend` folder
3. Framework: Vite
4. Add env variable: `VITE_API_URL=https://your-railway-url.app`
5. Deploy!

### Update CORS:
1. Go back to Railway → Variables
2. Add: `FRONTEND_URL=https://your-vercel-url.app`
3. Done! Test at your Vercel URL 🚀

### Requirements from client:
- GitHub account (free)
- Vercel account (free)
- Railway account ($5/month after trial)
- Google AI API key from AI Studio (pay-as-you-go)

### Cost estimate:
- Railway: $5/month
- Vercel: FREE
- Google AI: ~$20-80/month (depends on usage, 70% cheaper than OpenAI)
- **Total: ~$25-85/month**

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome!

---

Made with 💡 using Google Gemini 2.5 Pro & Nano Banana 🍌

Deployed on Railway (Backend) & Vercel (Frontend)
