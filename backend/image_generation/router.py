from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_conn, new_id, now_iso
from image_generation.agent import analyze_image_file, generate_image

router = APIRouter()


class ImageGenRequest(BaseModel):
    prompt: str
    style: str = "educational-diagram"


class ImageAnalyzeRequest(BaseModel):
    file_id: str
    prompt: str = "Analyze this image and explain its technical structure."


@router.post("/api/images/generate")
async def api_generate_image(payload: ImageGenRequest) -> Dict[str, Any]:
    img = generate_image(payload.prompt, payload.style)
    img_id = new_id()
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO generated_images (id, user_id, original_prompt, enhanced_prompt, style, provider, image_url, status, created_at)
        VALUES (?, 'u-default', ?, ?, ?, ?, ?, 'completed', ?)
        """,
        (img_id, img["original_prompt"], img["enhanced_prompt"], img["style"], img["provider"], img["image_url"], now_iso()),
    )
    conn.commit()
    conn.close()
    return {
        "success": True,
        "output": f"Generated `{payload.style}` diagram for: *{payload.prompt}*",
        "image": {"id": img_id, **img},
    }


@router.get("/api/images")
async def api_list_images() -> Dict[str, Any]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM generated_images ORDER BY created_at DESC LIMIT 30").fetchall()
    conn.close()
    return {"images": [dict(r) for r in rows]}


@router.post("/api/images/analyze")
async def api_analyze_image(payload: ImageAnalyzeRequest) -> Dict[str, Any]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (payload.file_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Uploaded image not found.")
    return analyze_image_file(row["file_path"], payload.prompt)
