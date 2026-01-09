from typing import List, Dict
import google.generativeai as genai
from main import ImageVariation, PostVariation
import httpx
import io
import base64
from PIL import Image


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    include_logo: bool
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image (Nano Banana)"""
    
    images = []
    
    # Determine required sizes
    sizes_needed = _get_required_sizes(platforms)
    
    # Take first post variation for image generation
    main_variation = variations[0] if variations else None
    
    # Create prompt for Nano Banana
    image_prompt = _build_image_prompt(website_data, main_variation)
    
    # Use Gemini 2.0 Flash Image for image generation (available with billing)
    model = genai.GenerativeModel('gemini-2.0-flash-preview-image-generation')
    
    for size_info in sizes_needed:
        try:
            # Generate with Nano Banana
            response = model.generate_content(
                image_prompt,
                generation_config={
                    "temperature": 0.4,
                    "top_p": 0.95,
                }
            )
            
            # Extract image from response
            if response.candidates and len(response.candidates) > 0:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        # Decode base64 image
                        image_data = base64.b64decode(part.inline_data.data)
                        
                        # Save temporarily or convert to URL (for now using data URL)
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        image_url = f"data:image/png;base64,{image_base64}"
                        
                        images.append(ImageVariation(
                            url=image_url,
                            size=size_info['name'],
                            dimensions=size_info['dimensions']
                        ))
                        break
            
        except Exception as e:
            print(f"Image generation error: {e}")
            # Fallback to placeholder
            images.append(ImageVariation(
                url=f"https://via.placeholder.com/{size_info['dimensions'].replace('x', 'x')}/1877f2/ffffff?text=Generated+Image",
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
    
    return images if images else _get_placeholder_images(sizes_needed)


def _get_required_sizes(platforms: List[str]) -> List[Dict]:
    """Determines required image sizes"""
    
    sizes = []
    
    if "instagram" in platforms:
        sizes.append({
            "name": "instagram_square",
            "dimensions": "1024x1024",
            "aspect_ratio": "1:1"
        })
    
    if "facebook" in platforms:
        sizes.append({
            "name": "facebook_landscape",
            "dimensions": "1024x1024",  # Nano Banana outputs 1024x1024
            "aspect_ratio": "1:1"
        })
    
    # If nothing selected - add universal square
    if not sizes:
        sizes.append({
            "name": "universal_square",
            "dimensions": "1024x1024",
            "aspect_ratio": "1:1"
        })
    
    return sizes


def _build_image_prompt(website_data: Dict, variation: PostVariation) -> str:
    """Creates prompt for image generation"""
    
    brand_colors = website_data.get('colors', [])
    colors_str = f"using brand colors: {', '.join(brand_colors[:3])}" if brand_colors else ""
    
    title = website_data.get('title', '')
    description = website_data.get('description', '')
    industry = website_data.get('industry', 'business')
    
    prompt = f"""
Create a modern, professional social media post image for {title}.

Style: Clean, eye-catching, modern design with professional photography or illustration.
Industry: {industry}
{colors_str}

Content focus: {description[:200]}

The image should be:
- Visually striking and scroll-stopping
- Professional but engaging
- Suitable for social media
- No text overlays (will be added later)
- High quality, crisp and clear

Mood: Inspiring, trustworthy, modern
"""
    
    return prompt.strip()


def _get_placeholder_images(sizes_needed: List[Dict]) -> List[ImageVariation]:
    """Returns placeholder images if generation fails"""
    return [
        ImageVariation(
            url=f"https://via.placeholder.com/{size['dimensions']}/4285f4/ffffff?text=Social+Media+Post",
            size=size['name'],
            dimensions=size['dimensions']
        )
        for size in sizes_needed
    ]
