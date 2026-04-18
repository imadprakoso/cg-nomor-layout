import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.pdf_engine import generate_coupon_layout

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"


class GenerateRequest(BaseModel):
    file_id: str
    page_width_mm: float = 485
    page_height_mm: float = 325
    cols: int = 5
    rows: int = 5
    crop_mark_extra_mm: float = 5
    kupon_per_file: int = 500
    use_cropmark: bool = True


@router.post("/generate")
def generate_layout(payload: GenerateRequest):
    matched_files = list(UPLOAD_DIR.glob(f"{payload.file_id}.*"))

    if not matched_files:
        raise HTTPException(status_code=404, detail="File upload tidak ditemukan")

    input_pdf = str(matched_files[0])
    job_id = str(uuid.uuid4())
    output_folder = os.path.join(str(OUTPUT_DIR), job_id)

    try:
        result = generate_coupon_layout(
            input_pdf=input_pdf,
            output_folder=output_folder,
            page_width_mm=payload.page_width_mm,
            page_height_mm=payload.page_height_mm,
            cols=payload.cols,
            rows=payload.rows,
            crop_mark_extra_mm=payload.crop_mark_extra_mm,
            kupon_per_file=payload.kupon_per_file,
            use_cropmark=payload.use_cropmark,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "success": True,
        "job_id": job_id,
        "files": result["generated_files"],
        "output_folder": output_folder,
        "total_input_pages": result["total_input_pages"],
    }