"""
Design reference system - Save and reuse design styles
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
import logging
from uuid import uuid4

from database.supabase_client import get_supabase_client
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/designs", tags=["designs"])

class DesignReference(BaseModel):
    id: str
    account_id: str
    name: str
    description: Optional[str]
    style_prompt: Optional[str]
    image_urls: List[str]
    times_used: int
    created_at: str

class CreateDesignRequest(BaseModel):
    name: str
    description: Optional[str] = None
    style_prompt: Optional[str] = None  # AI-extracted or user-provided style description

@router.post("/upload")
async def upload_design_references(
    account_id: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload reference images for design style matching
    """
    try:
        if len(files) == 0:
            raise HTTPException(status_code=400, detail="At least 1 image required")
        
        if len(files) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 images allowed")
        
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        uploaded_urls = []
        
        for file in files:
            # Validate file type
            allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
            if file.content_type not in allowed_types:
                continue
            
            # Read file content
            file_content = await file.read()
            
            # Generate unique filename
            file_ext = file.filename.split(".")[-1]
            unique_filename = f"{current_user['id']}/{account_id}/{uuid4()}.{file_ext}"
            
            # Upload to Supabase Storage (private bucket)
            supabase.storage.from_("designs").upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": file.content_type}
            )
            
            # Get public URL
            public_url = supabase.storage.from_("designs").get_public_url(unique_filename)
            uploaded_urls.append(public_url)
        
        logger.info(f"✅ Uploaded {len(uploaded_urls)} design references")
        
        return {
            "uploaded": len(uploaded_urls),
            "urls": uploaded_urls
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload design error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-style")
async def analyze_design_style(
    image_url: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI to analyze image and extract style description
    This helps create better prompts for matching the style
    """
    try:
        import google.generativeai as genai
        
        # Use Gemini Vision to analyze the image
        model = genai.GenerativeModel('gemini-3-flash-preview')
        
        prompt = """
        Analyze this image and describe its visual style in detail.
        Focus on:
        - Color palette and mood
        - Composition and layout
        - Typography (if any)
        - Artistic style (modern, vintage, minimalist, etc.)
        - Lighting and atmosphere
        - Overall aesthetic
        
        Provide a concise style description (2-3 sentences) that could be used as a prompt for generating similar images.
        """
        
        # Download image (Gemini can accept URLs or file content)
        response = model.generate_content([prompt, {"mime_type": "image/jpeg", "data": image_url}])
        
        style_description = response.text.strip()
        
        logger.info(f"✅ Style analyzed: {style_description[:100]}...")
        
        return {
            "style_prompt": style_description
        }
        
    except Exception as e:
        logger.error(f"❌ Style analysis error: {str(e)}")
        # Fallback to empty prompt if analysis fails
        return {
            "style_prompt": ""
        }

@router.post("", response_model=DesignReference)
async def create_design_reference(
    request: CreateDesignRequest,
    account_id: str,
    image_urls: List[str],
    current_user: dict = Depends(get_current_user)
):
    """
    Save design reference after uploading images
    """
    try:
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Create design reference
        response = supabase.table("design_references").insert({
            "account_id": account_id,
            "name": request.name,
            "description": request.description,
            "style_prompt": request.style_prompt,
            "image_urls": image_urls,
            "times_used": 0
        }).execute()
        
        logger.info(f"✅ Design reference created: {request.name}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create design error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[DesignReference])
async def list_design_references(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    List all design references for an account
    """
    try:
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        response = supabase.table("design_references")\
            .select("*")\
            .eq("account_id", account_id)\
            .order("times_used", desc=True)\
            .execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ List designs error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{design_id}/use")
async def mark_design_used(
    design_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Increment usage counter when design is used
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        design = supabase.table("design_references")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", design_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not design.data:
            raise HTTPException(status_code=404, detail="Design not found")
        
        # Increment counter
        new_count = design.data["times_used"] + 1
        supabase.table("design_references")\
            .update({"times_used": new_count})\
            .eq("id", design_id)\
            .execute()
        
        return {"times_used": new_count}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Mark design used error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{design_id}")
async def delete_design_reference(
    design_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete design reference
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        design = supabase.table("design_references")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", design_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not design.data:
            raise HTTPException(status_code=404, detail="Design not found")
        
        # Delete from database
        supabase.table("design_references").delete().eq("id", design_id).execute()
        
        # TODO: Delete images from storage
        
        logger.info(f"✅ Design deleted: {design_id}")
        return {"message": "Design reference deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete design error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
