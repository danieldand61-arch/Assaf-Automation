"""
Person-specific image generation
Upload reference images of a person for consistent AI generation
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
import logging
from uuid import uuid4

from database.supabase_client import get_supabase_client
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/persons", tags=["persons"])

class Person(BaseModel):
    id: str
    account_id: str
    name: str
    description: Optional[str]
    image_urls: List[str]
    model_status: str  # 'pending', 'training', 'ready', 'failed'
    model_id: Optional[str]
    created_at: str

class CreatePersonRequest(BaseModel):
    name: str
    description: Optional[str] = None

@router.post("/upload")
async def upload_person_images(
    account_id: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload multiple reference images of a person
    Minimum 3 images recommended for best results
    """
    try:
        if len(files) < 3:
            raise HTTPException(status_code=400, detail="Minimum 3 images required for person training")
        
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
        
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
            allowed_types = ["image/jpeg", "image/png", "image/jpg"]
            if file.content_type not in allowed_types:
                continue  # Skip invalid files
            
            # Read file content
            file_content = await file.read()
            
            # Generate unique filename
            file_ext = file.filename.split(".")[-1]
            unique_filename = f"{current_user['id']}/{account_id}/{uuid4()}.{file_ext}"
            
            # Upload to Supabase Storage (private bucket)
            supabase.storage.from_("persons").upload(
                path=unique_filename,
                file=file_content,
                file_options={"content-type": file.content_type}
            )
            
            # Get public URL (signed URL for private bucket)
            public_url = supabase.storage.from_("persons").get_public_url(unique_filename)
            uploaded_urls.append(public_url)
        
        logger.info(f"✅ Uploaded {len(uploaded_urls)} person images")
        
        return {
            "uploaded": len(uploaded_urls),
            "urls": uploaded_urls
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload person images error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=Person)
async def create_person(
    request: CreatePersonRequest,
    account_id: str,
    image_urls: List[str],
    current_user: dict = Depends(get_current_user)
):
    """
    Create person entry after uploading images
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
        
        # Create person
        response = supabase.table("person_images").insert({
            "account_id": account_id,
            "name": request.name,
            "description": request.description,
            "image_urls": image_urls,
            "model_status": "pending"
        }).execute()
        
        logger.info(f"✅ Person created: {request.name}")
        
        # TODO: Trigger AI model training/fine-tuning
        # This would require integration with a service like:
        # - OpenAI fine-tuning API
        # - Stable Diffusion Dreambooth
        # - Google Gemini fine-tuning (when available)
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create person error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[Person])
async def list_persons(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    List all persons for an account
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
        
        response = supabase.table("person_images")\
            .select("*")\
            .eq("account_id", account_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ List persons error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{person_id}", response_model=Person)
async def get_person(
    person_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get person by ID
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("person_images")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", person_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Person not found")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get person error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{person_id}")
async def delete_person(
    person_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete person and their reference images
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        person = supabase.table("person_images")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", person_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not person.data:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Delete from database
        supabase.table("person_images").delete().eq("id", person_id).execute()
        
        # TODO: Delete images from storage
        # TODO: Delete fine-tuned model if exists
        
        logger.info(f"✅ Person deleted: {person_id}")
        return {"message": "Person deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete person error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
