# Social Media Automation & Ad Creation System

A powerful, user-friendly platform that takes a website URL and keywords, then automatically creates professional social media posts with eye-catching AI-generated images for Facebook and Instagram.

## 🚀 Features (Phase 1)

- **Smart Website Analysis**: Automatically extracts brand information, colors, logo, and tone
- **AI Content Generation**: GPT-4 creates 4 unique post variations for each platform
- **AI Image Generation**: DALL-E 3 generates images in optimal sizes for each platform
- **Multi-Platform Support**: Facebook & Instagram with platform-specific optimizations
- **Smart Hashtags**: Auto-generates trending and relevant hashtags
- **Engagement Score**: Predicts post performance likelihood
- **Live Preview**: See how posts will look on each platform
- **Multiple Sizes**: Square (1080x1080), Landscape (1200x630), Story (1080x1920)

## 📋 Requirements

- Python 3.10+
- Node.js 18+
- OpenAI API Key

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

1. Get an API key from https://platform.openai.com/api-keys
2. Create `backend/.env` file:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
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

1. Enter a website URL (e.g., `https://apple.com`)
2. Add keywords/description (e.g., `new iPhone, innovation, technology`)
3. Select platforms (Facebook, Instagram, or both)
4. Choose style (Professional, Casual, Funny, etc.)
5. Select target audience
6. Enter industry
7. Toggle emojis and logo options
8. Click "Generate Content"
9. Wait 30-60 seconds for AI generation
10. Review 4 post variations with images
11. Download all content as ZIP

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
- GPT-4 Turbo: ~$0.05-0.10
- DALL-E 3: ~$0.12-0.24
- **Total: ~$0.20-0.35**

## 🎨 Tech Stack

**Backend:**
- FastAPI (async Python web framework)
- OpenAI GPT-4 & DALL-E 3
- BeautifulSoup4 (web scraping)
- httpx (async HTTP)
- Pillow (image processing)

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Zustand (state management)
- Lucide React (icons)

## 🐛 Troubleshooting

### Backend won't start
- Check Python version: `python --version` (needs 3.10+)
- Install dependencies: `pip install -r requirements.txt`
- Verify port 8000 is available

### Frontend won't start
- Check Node version: `node --version` (needs 18+)
- Reinstall: `rm -rf node_modules && npm install`
- Verify port 3000 is available

### "OpenAI API key not found"
- Ensure `.env` file exists in `backend/` directory
- Verify API key is valid and active
- Check balance at https://platform.openai.com/usage

### CORS errors
- Ensure backend is running on port 8000
- Check CORS middleware in `main.py`

## 📈 Roadmap

### Phase 1: ✅ COMPLETE
- Smart content generation
- Multi-platform support
- AI images
- Preview system

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

Ready to deploy? Check out:
- **[DEPLOY_STEPS.md](DEPLOY_STEPS.md)** - Quick step-by-step guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detailed deployment documentation

**Recommended setup:**
- Frontend → **Vercel** (free, optimized for React)
- Backend → **Railway** ($5/month, perfect for FastAPI + AI)

Deploy in 10 minutes! 🚀

## 📝 License

MIT

## 🤝 Contributing

Pull requests welcome!

---

Made with 💡 using GPT-4 & DALL-E 3
