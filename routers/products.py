"""
Product library routes - Upload and manage product images
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
import logging
from uuid import uuid4
import os

from database.supabase_client import get_supabase_client
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/products", tags=["products"])

class Product(BaseModel):
    id: str
    account_id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    tags: List[str]
    image_url: str
    thumbnail_url: Optional[str]
    is_active: bool
    created_at: str

class CreateProductRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None

@router.post("/upload")
async def upload_product_image(
    account_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload product image to Supabase Storage
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
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, WebP allowed")
        
        # Read file content
        file_content = await file.read()
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{account_id}/{uuid4()}.{file_ext}"
        
        # Upload to Supabase Storage
        result = supabase.storage.from_("products").upload(
            path=unique_filename,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("products").get_public_url(unique_filename)
        
        logger.info(f"✅ Product image uploaded: {unique_filename}")
        
        return {
            "filename": unique_filename,
            "url": public_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=Product)
async def create_product(
    request: CreateProductRequest,
    account_id: str,
    image_url: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Create product in library (after image upload)
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
        
        # Create product
        response = supabase.table("products").insert({
            "account_id": account_id,
            "name": request.name,
            "description": request.description,
            "category": request.category,
            "tags": request.tags,
            "image_url": image_url,
            "is_active": True
        }).execute()
        
        logger.info(f"✅ Product created: {request.name}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create product error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[Product])
async def list_products(
    account_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    List all products for an account with optional filters
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
        
        # Query products
        query = supabase.table("products")\
            .select("*")\
            .eq("account_id", account_id)\
            .eq("is_active", True)\
            .order("created_at", desc=True)
        
        if category:
            query = query.eq("category", category)
        
        if search:
            # Full-text search on name and description
            query = query.ilike("name", f"%{search}%")
        
        response = query.execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ List products error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{product_id}", response_model=Product)
async def get_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get product by ID
    """
    try:
        supabase = get_supabase_client()
        
        # Get product with account ownership check
        response = supabase.table("products")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", product_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get product error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{product_id}", response_model=Product)
async def update_product(
    product_id: str,
    request: UpdateProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update product
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        product = supabase.table("products")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", product_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not product.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Build update data
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.category is not None:
            update_data["category"] = request.category
        if request.tags is not None:
            update_data["tags"] = request.tags
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
        
        response = supabase.table("products")\
            .update(update_data)\
            .eq("id", product_id)\
            .execute()
        
        logger.info(f"✅ Product updated: {product_id}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update product error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete product (soft delete - set is_active=false)
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        product = supabase.table("products")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", product_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not product.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Soft delete
        supabase.table("products")\
            .update({"is_active": False})\
            .eq("id", product_id)\
            .execute()
        
        logger.info(f"✅ Product deleted: {product_id}")
        return {"message": "Product deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete product error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories/list")
async def list_categories(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of unique categories for an account
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
        
        # Get distinct categories
        response = supabase.table("products")\
            .select("category")\
            .eq("account_id", account_id)\
            .eq("is_active", True)\
            .execute()
        
        categories = list(set([p["category"] for p in response.data if p.get("category")]))
        
        return {"categories": sorted(categories)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ List categories error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
