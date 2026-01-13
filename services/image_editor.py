"""
Image overlay editor service
Add text, shapes, icons, stickers to images
"""
from PIL import Image, ImageDraw, ImageFont
from typing import Dict, List, Tuple, Optional
import io
import base64
import logging
import httpx

logger = logging.getLogger(__name__)

class ImageEditor:
    """
    Image editing service for adding overlays, text, shapes
    """
    
    @staticmethod
    async def load_image_from_url(url: str) -> Image.Image:
        """Load image from URL"""
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content))
    
    @staticmethod
    def load_image_from_base64(data: str) -> Image.Image:
        """Load image from base64 string"""
        # Remove data:image prefix if present
        if "," in data:
            data = data.split(",")[1]
        
        image_bytes = base64.b64decode(data)
        return Image.open(io.BytesIO(image_bytes))
    
    @staticmethod
    def image_to_base64(image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        
        # Convert RGBA to RGB if needed
        if image.mode == 'RGBA':
            rgb_image = Image.new('RGB', image.size, (255, 255, 255))
            rgb_image.paste(image, mask=image.split()[3])
            image = rgb_image
        
        image.save(buffer, format='JPEG', quality=90)
        img_bytes = buffer.getvalue()
        
        return f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}"
    
    @staticmethod
    def add_text_overlay(
        image: Image.Image,
        text: str,
        position: Tuple[int, int],
        font_size: int = 40,
        color: str = "#FFFFFF",
        font_name: str = "arial",
        align: str = "left",
        stroke_width: int = 0,
        stroke_color: str = "#000000",
        background_color: Optional[str] = None,
        background_padding: int = 10
    ) -> Image.Image:
        """
        Add text overlay to image
        
        Args:
            image: PIL Image
            text: Text to add
            position: (x, y) coordinates
            font_size: Font size in pixels
            color: Text color (hex)
            font_name: Font name (limited to system fonts)
            align: Text alignment ('left', 'center', 'right')
            stroke_width: Outline width
            stroke_color: Outline color
            background_color: Optional background color for text
            background_padding: Padding around text background
        """
        try:
            image = image.copy()
            draw = ImageDraw.Draw(image, 'RGBA')
            
            # Try to load font, fall back to default if not found
            try:
                font = ImageFont.truetype(font_name, font_size)
            except:
                try:
                    # Try common font paths
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
                except:
                    font = ImageFont.load_default()
            
            # Convert hex color to RGB
            def hex_to_rgb(hex_color):
                hex_color = hex_color.lstrip('#')
                return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            
            text_color = hex_to_rgb(color)
            
            # Get text bounding box
            bbox = draw.textbbox(position, text, font=font)
            
            # Draw background if specified
            if background_color:
                bg_color = hex_to_rgb(background_color) + (200,)  # Add alpha
                bg_bbox = (
                    bbox[0] - background_padding,
                    bbox[1] - background_padding,
                    bbox[2] + background_padding,
                    bbox[3] + background_padding
                )
                draw.rectangle(bg_bbox, fill=bg_color)
            
            # Draw text
            if stroke_width > 0:
                stroke_rgb = hex_to_rgb(stroke_color)
                draw.text(
                    position,
                    text,
                    font=font,
                    fill=text_color,
                    stroke_width=stroke_width,
                    stroke_fill=stroke_rgb
                )
            else:
                draw.text(position, text, font=font, fill=text_color)
            
            logger.info(f"✅ Text overlay added: '{text[:30]}...'")
            return image
            
        except Exception as e:
            logger.error(f"❌ Error adding text overlay: {str(e)}")
            return image
    
    @staticmethod
    def add_shape(
        image: Image.Image,
        shape_type: str,
        position: Tuple[int, int],
        size: Tuple[int, int],
        color: str = "#FF0000",
        fill_opacity: float = 0.5,
        border_width: int = 0,
        border_color: str = "#000000"
    ) -> Image.Image:
        """
        Add shape overlay (rectangle, circle, etc.)
        
        Args:
            shape_type: 'rectangle', 'circle', 'ellipse'
            position: (x, y) top-left coordinates
            size: (width, height)
            color: Fill color (hex)
            fill_opacity: 0.0 to 1.0
            border_width: Border thickness
            border_color: Border color (hex)
        """
        try:
            image = image.copy()
            overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)
            
            # Convert hex to RGBA
            def hex_to_rgba(hex_color, opacity):
                hex_color = hex_color.lstrip('#')
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                return rgb + (int(opacity * 255),)
            
            fill_color = hex_to_rgba(color, fill_opacity)
            border_rgb = hex_to_rgba(border_color, 1.0) if border_width > 0 else None
            
            # Calculate bounding box
            x, y = position
            w, h = size
            bbox = [x, y, x + w, y + h]
            
            # Draw shape
            if shape_type == "rectangle":
                draw.rectangle(bbox, fill=fill_color, outline=border_rgb, width=border_width)
            elif shape_type == "circle":
                # Make it a perfect circle (use smallest dimension)
                radius = min(w, h) // 2
                bbox = [x, y, x + radius * 2, y + radius * 2]
                draw.ellipse(bbox, fill=fill_color, outline=border_rgb, width=border_width)
            elif shape_type == "ellipse":
                draw.ellipse(bbox, fill=fill_color, outline=border_rgb, width=border_width)
            
            # Composite overlay onto original image
            image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')
            
            logger.info(f"✅ Shape overlay added: {shape_type}")
            return image
            
        except Exception as e:
            logger.error(f"❌ Error adding shape: {str(e)}")
            return image
    
    @staticmethod
    def add_arrow(
        image: Image.Image,
        start: Tuple[int, int],
        end: Tuple[int, int],
        color: str = "#FF0000",
        width: int = 5,
        arrow_size: int = 20
    ) -> Image.Image:
        """
        Add arrow annotation
        """
        try:
            image = image.copy()
            draw = ImageDraw.Draw(image)
            
            # Convert hex to RGB
            def hex_to_rgb(hex_color):
                hex_color = hex_color.lstrip('#')
                return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            
            arrow_color = hex_to_rgb(color)
            
            # Draw line
            draw.line([start, end], fill=arrow_color, width=width)
            
            # Calculate arrow head
            import math
            angle = math.atan2(end[1] - start[1], end[0] - start[0])
            
            # Arrow head points
            arrow_angle = math.pi / 6  # 30 degrees
            left_x = end[0] - arrow_size * math.cos(angle - arrow_angle)
            left_y = end[1] - arrow_size * math.sin(angle - arrow_angle)
            right_x = end[0] - arrow_size * math.cos(angle + arrow_angle)
            right_y = end[1] - arrow_size * math.sin(angle + arrow_angle)
            
            # Draw arrow head
            draw.polygon([end, (left_x, left_y), (right_x, right_y)], fill=arrow_color)
            
            logger.info(f"✅ Arrow added from {start} to {end}")
            return image
            
        except Exception as e:
            logger.error(f"❌ Error adding arrow: {str(e)}")
            return image
    
    @staticmethod
    async def add_icon_overlay(
        image: Image.Image,
        icon_url: str,
        position: Tuple[int, int],
        size: Optional[Tuple[int, int]] = None
    ) -> Image.Image:
        """
        Add icon/sticker overlay from URL
        """
        try:
            image = image.copy()
            
            # Download icon
            icon = await ImageEditor.load_image_from_url(icon_url)
            
            # Resize if size specified
            if size:
                icon = icon.resize(size, Image.Resampling.LANCZOS)
            
            # Convert to RGBA if needed
            if icon.mode != 'RGBA':
                icon = icon.convert('RGBA')
            
            # Paste icon with transparency
            image.paste(icon, position, icon)
            
            logger.info(f"✅ Icon overlay added at {position}")
            return image
            
        except Exception as e:
            logger.error(f"❌ Error adding icon: {str(e)}")
            return image
