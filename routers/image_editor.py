"""
Image editor API routes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Tuple, Optional
import logging

from services.image_editor import ImageEditor
from middleware.auth import get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/image-editor", tags=["image-editor"])

class TextOverlay(BaseModel):
    text: str
    position: Tuple[int, int]
    font_size: int = 40
    color: str = "#FFFFFF"
    font_name: str = "arial"
    stroke_width: int = 0
    stroke_color: str = "#000000"
    background_color: Optional[str] = None
    background_padding: int = 10

class ShapeOverlay(BaseModel):
    shape_type: str  # 'rectangle', 'circle', 'ellipse'
    position: Tuple[int, int]
    size: Tuple[int, int]
    color: str = "#FF0000"
    fill_opacity: float = 0.5
    border_width: int = 0
    border_color: str = "#000000"

class ArrowOverlay(BaseModel):
    start: Tuple[int, int]
    end: Tuple[int, int]
    color: str = "#FF0000"
    width: int = 5
    arrow_size: int = 20

class IconOverlay(BaseModel):
    icon_url: str
    position: Tuple[int, int]
    size: Optional[Tuple[int, int]] = None

class EditImageRequest(BaseModel):
    image_source: str  # URL or base64
    text_overlays: List[TextOverlay] = []
    shape_overlays: List[ShapeOverlay] = []
    arrow_overlays: List[ArrowOverlay] = []
    icon_overlays: List[IconOverlay] = []

@router.post("/edit")
async def edit_image(
    request: EditImageRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Edit image by adding text, shapes, arrows, icons
    Works for both authenticated and anonymous users
    """
    try:
        logger.info(f"🎨 Editing image with {len(request.text_overlays)} texts, "
                   f"{len(request.shape_overlays)} shapes, {len(request.arrow_overlays)} arrows, "
                   f"{len(request.icon_overlays)} icons")
        
        # Load base image
        if request.image_source.startswith('http'):
            image = await ImageEditor.load_image_from_url(request.image_source)
        else:
            image = ImageEditor.load_image_from_base64(request.image_source)
        
        # Apply text overlays
        for text_overlay in request.text_overlays:
            image = ImageEditor.add_text_overlay(
                image,
                text=text_overlay.text,
                position=text_overlay.position,
                font_size=text_overlay.font_size,
                color=text_overlay.color,
                font_name=text_overlay.font_name,
                stroke_width=text_overlay.stroke_width,
                stroke_color=text_overlay.stroke_color,
                background_color=text_overlay.background_color,
                background_padding=text_overlay.background_padding
            )
        
        # Apply shape overlays
        for shape_overlay in request.shape_overlays:
            image = ImageEditor.add_shape(
                image,
                shape_type=shape_overlay.shape_type,
                position=shape_overlay.position,
                size=shape_overlay.size,
                color=shape_overlay.color,
                fill_opacity=shape_overlay.fill_opacity,
                border_width=shape_overlay.border_width,
                border_color=shape_overlay.border_color
            )
        
        # Apply arrow overlays
        for arrow_overlay in request.arrow_overlays:
            image = ImageEditor.add_arrow(
                image,
                start=arrow_overlay.start,
                end=arrow_overlay.end,
                color=arrow_overlay.color,
                width=arrow_overlay.width,
                arrow_size=arrow_overlay.arrow_size
            )
        
        # Apply icon overlays
        for icon_overlay in request.icon_overlays:
            image = await ImageEditor.add_icon_overlay(
                image,
                icon_url=icon_overlay.icon_url,
                position=icon_overlay.position,
                size=icon_overlay.size
            )
        
        # Convert to base64 for response
        edited_image_base64 = ImageEditor.image_to_base64(image)
        
        logger.info(f"✅ Image edited successfully")
        
        return {
            "image": edited_image_base64,
            "width": image.width,
            "height": image.height
        }
        
    except Exception as e:
        logger.error(f"❌ Image edit error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fonts")
async def list_available_fonts():
    """
    Get list of available fonts
    """
    # Common system fonts that should be available
    fonts = [
        "arial",
        "helvetica",
        "times",
        "courier",
        "verdana",
        "georgia",
        "comic_sans",
        "trebuchet",
        "impact"
    ]
    
    return {"fonts": fonts}

@router.get("/presets")
async def get_preset_styles():
    """
    Get preset text/shape styles for common use cases
    """
    presets = {
        "real_estate": {
            "for_sale": {
                "text": "FOR SALE",
                "font_size": 60,
                "color": "#FFFFFF",
                "background_color": "#FF0000",
                "background_padding": 20,
                "stroke_width": 2,
                "stroke_color": "#000000"
            },
            "price_tag": {
                "text": "$XXX,XXX",
                "font_size": 50,
                "color": "#FFD700",
                "stroke_width": 3,
                "stroke_color": "#000000"
            }
        },
        "promotional": {
            "discount": {
                "text": "50% OFF",
                "font_size": 70,
                "color": "#FFFFFF",
                "background_color": "#FF4500",
                "stroke_width": 3
            },
            "limited_time": {
                "text": "LIMITED TIME",
                "font_size": 40,
                "color": "#FF0000",
                "background_color": "#FFFF00"
            }
        },
        "social": {
            "call_to_action": {
                "text": "SWIPE UP",
                "font_size": 45,
                "color": "#FFFFFF",
                "stroke_width": 2,
                "stroke_color": "#000000"
            }
        }
    }
    
    return {"presets": presets}
