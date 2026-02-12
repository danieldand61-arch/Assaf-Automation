# 🎬 Video Generation Setup Guide

## Overview

The platform now supports **two types of video generation**:

1. **AI Video Generation** (Kling AI) - Text/Image → AI creates video
2. **Template Videos** (Remotion) - Customizable product video templates

---

## 🤖 AI Video Generation (Kling AI)

### Features:
- **Text-to-Video**: Describe a scene → AI generates video
- **Image-to-Video**: Upload image + prompt → AI animates it
- **Native audio**: Optional sound generation
- **Flexible duration**: 5 or 10 seconds
- **Multiple aspect ratios**: 16:9, 9:16, 1:1

### Pricing:
| Duration | Without Sound | With Sound |
|----------|---------------|------------|
| 5 seconds | 65 credits | 130 credits |
| 10 seconds | 130 credits | 260 credits |

### Setup Instructions:

#### 1. Get Kling API Key

1. Visit https://kling26ai.com/
2. Sign up or log in
3. Navigate to **Account** → **API Keys**
4. Click **Create New API Key**
5. Copy the generated key

#### 2. Add to Railway

1. Go to Railway Dashboard → Your Project
2. Navigate to **Variables** tab
3. Click **Add Variable**
4. Add:
   ```
   Name: KLING_API_KEY
   Value: your_api_key_here
   ```
5. Click **Redeploy**

#### 3. Test

1. Go to your platform → **Video Generation** page
2. Select **Text to Video** or **Image to Video** tab
3. Enter a prompt (e.g., "A cat playing piano in a studio")
4. Click **Generate Video**
5. Wait 1-2 minutes for the video to be ready

---

## 🎨 Template Videos (Remotion)

### Features:
- **Product video template** with professional animations
- **Real-time preview** - see changes instantly
- **Fully customizable**:
  - Product title
  - Description
  - Price
  - Product image
- **Animations include**:
  - Image fade in + scale up
  - Text slide in from right
  - Description slide up from bottom
  - Price pulse effect
- **Perfect for**:
  - E-commerce product showcases
  - Batch video generation (multiple products)
  - Consistent branding

### Current Status:
✅ **Live Preview** - works immediately, no setup required!  
⏳ **Full Video Render** - requires backend setup (coming soon)

### How to Use (Preview):

1. Go to **Video Generation** → **Video Templates** tab
2. Fill in the form:
   - **Title**: e.g., "iPhone 15 Pro"
   - **Description**: e.g., "Titanium design with A17 Pro chip"
   - **Price**: e.g., 999
   - **Image URL**: Product image URL
3. Click **Play** on the preview player
4. Watch your customized video with animations!

### Template Output:
- **Duration**: 5 seconds
- **Resolution**: 1920x1080 (Full HD)
- **FPS**: 30
- **Format**: MP4 (when render is enabled)

### Future Backend Integration:

For full render capability, we need to set up:

**Option 1: Remotion Lambda (AWS)**
- Deploy Remotion render function to AWS Lambda
- Automatic scaling
- Cost: ~$0.01 per video render

**Option 2: Local Render Server**
- Self-hosted render server
- No per-video costs
- Requires server with FFmpeg

---

## 📊 Admin Panel

Both types of video generation are tracked in the Admin Panel:

- **Kling AI videos**: Shows as `video_generation` with credits
- **Remotion renders**: Will show as `video_render` when enabled

---

## 🆚 When to Use Which?

| Use Case | Solution |
|----------|----------|
| "Generate a creative video from text" | **Kling AI** |
| "Animate this image" | **Kling AI** |
| "Create 100 product videos with same style" | **Remotion** |
| "Professional product showcase template" | **Remotion** |
| "One-time creative video" | **Kling AI** |
| "Batch generation for e-commerce" | **Remotion** |
| "AI-generated content" | **Kling AI** |
| "Consistent branding across videos" | **Remotion** |

---

## 🔧 Troubleshooting

### Kling AI Issues

**"Invalid API key"**
- Check that `KLING_API_KEY` is set correctly in Railway
- Ensure no extra spaces in the key
- Verify key is active at https://kling26ai.com/

**"Insufficient credits"**
- Check your Kling AI account balance
- Top up credits at https://kling26ai.com/

**"Generation failed"**
- Check prompt length (max 1000 characters)
- Ensure image URLs are publicly accessible
- Try with a simpler prompt first

### Remotion Issues

**Preview not loading**
- Check browser console for errors
- Ensure image URL is accessible (CORS-enabled)
- Try with placeholder image first

**"Render Full Video" disabled**
- This is expected - backend integration not yet complete
- Preview works 100% for testing templates
- Contact dev team to enable full render

---

## 📝 Notes

- **Kling AI** requires API key and credits
- **Remotion** preview works immediately without any setup
- **Remotion** full render will be added in future update
- All usage is tracked in Admin Panel for transparency

---

## 🚀 Quick Start Checklist

### For Kling AI:
- [ ] Create Kling account
- [ ] Get API key
- [ ] Add to Railway environment variables
- [ ] Redeploy
- [ ] Test with simple text-to-video

### For Remotion:
- [ ] Go to Video Generation page
- [ ] Click Video Templates tab
- [ ] Fill in product details
- [ ] Click play and enjoy preview!

---

Need help? Contact the development team! 🎉
