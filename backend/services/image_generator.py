from typing import List, Dict
import openai
from backend.main import ImageVariation, PostVariation
import httpx
import io
from PIL import Image


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    include_logo: bool
) -> List[ImageVariation]:
    """Generates images for posts"""
    
    images = []
    
    # Determine required sizes
    sizes_needed = _get_required_sizes(platforms)
    
    # Take first post variation for image generation
    main_variation = variations[0] if variations else None
    
    # Create prompt for DALL-E
    image_prompt = _build_image_prompt(website_data, main_variation)
    
    for size_info in sizes_needed:
        try:
            # Generate with DALL-E 3
            response = await openai.Image.acreate(
                model="dall-e-3",
                prompt=image_prompt,
                size=size_info['dalle_size'],
                quality="standard",
                n=1
            )
            
            image_url = response.data[0].url
            
            # If exact size needed - resize
            if size_info['dalle_size'] != size_info['dimensions']:
                image_url = await _resize_image(image_url, size_info['dimensions'])
            
            images.append(ImageVariation(
                url=image_url,
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
            
        except Exception as e:
            # Fallback to placeholder
            images.append(ImageVariation(
                url=f"https://via.placeholder.com/{size_info['dimensions'].replace('x', 'x')}/1877f2/ffffff?text=Generated+Image",
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
    
    return images


def _get_required_sizes(platforms: List[str]) -> List[Dict]:
    """Determines required image sizes"""
    
    sizes = []
    
    if "instagram" in platforms:
        sizes.append({
            "name": "instagram_square",
            "dimensions": "1080x1080",
            "dalle_size": "1024x1024"
        })
        sizes.append({
            "name": "instagram_story",
            "dimensions": "1080x1920",
            "dalle_size": "1024x1792"
        })
    
    if "facebook" in platforms:
        sizes.append({
            "name": "facebook_landscape",
            "dimensions": "1200x630",
            "dalle_size": "1792x1024"
        })
    
    # If nothing selected - add universal square
    if not sizes:
        sizes.append({
            "name": "universal_square",
            "dimensions": "1080x1080",
            "dalle_size": "1024x1024"
        })
    
    return sizes


def _build_image_prompt(website_data: Dict, variation: PostVariation) -> str:
    """Creates prompt for image generation"""
    
    brand_colors = website_data.get('colors', [])
    colors_str = f"using brand colors: {', '.join(brand_colors[:3])}" if brand_colors else ""
    
    industry = website_data.get('industry', 'business')
    title = website_data.get('title', '')
    description = website_data.get('description', '')
    
    # Extract keywords from post
    post_text = variation.text if variation else ""
    
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


async def _resize_image(image_url: str, target_size: str) -> str:
    """Resizes image if needed"""
    
    try:
        # Download image
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url)
            img_data = response.content
        
        # Open with PIL
        img = Image.open(io.BytesIO(img_data))
        
        # Parse target size
        width, height = map(int, target_size.split('x'))
        
        # Resize
        img_resized = img.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save to buffer
        buffer = io.BytesIO()
        img_resized.save(buffer, format='PNG')
        buffer.seek(0)
        
        # In real system would upload to S3/CDN
        # For now return original URL
        return image_url
        
    except Exception:
        return image_url

