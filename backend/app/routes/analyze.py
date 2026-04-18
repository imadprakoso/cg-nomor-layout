from pathlib import Path
from math import floor

import fitz
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"


class AnalyzeRequest(BaseModel):
    file_id: str
    page_width_mm: float = 325
    page_height_mm: float = 485
    crop_mark_extra_mm: float = 5
    outer_gap_mm: float = 3


@router.post("/analyze")
def analyze_upload(payload: AnalyzeRequest):
    matched_files = list(UPLOAD_DIR.glob(f"{payload.file_id}.*"))

    if not matched_files:
        raise HTTPException(status_code=404, detail="File upload tidak ditemukan")

    input_pdf = str(matched_files[0])

    doc = fitz.open(input_pdf)
    if len(doc) == 0:
        raise HTTPException(status_code=400, detail="PDF kosong")

    first_page = doc[0]
    kupon_width_pt = first_page.rect.width
    kupon_height_pt = first_page.rect.height

    kupon_width_mm = kupon_width_pt * 25.4 / 72
    kupon_height_mm = kupon_height_pt * 25.4 / 72

    # ruang efektif kertas dikurangi cropmark luar
    # kiri-kanan: outer_gap + crop_mark_extra
    effective_width = payload.page_width_mm - 2 * (payload.outer_gap_mm + payload.crop_mark_extra_mm)
    effective_height = payload.page_height_mm - 2 * (payload.outer_gap_mm + payload.crop_mark_extra_mm)

    suggested_cols = max(1, floor(effective_width / kupon_width_mm))
    suggested_rows = max(1, floor(effective_height / kupon_height_mm))

    total_layout_width = suggested_cols * kupon_width_mm
    total_layout_height = suggested_rows * kupon_height_mm

    return {
        "success": True,
        "kupon_width_mm": round(kupon_width_mm, 2),
        "kupon_height_mm": round(kupon_height_mm, 2),
        "paper_width_mm": payload.page_width_mm,
        "paper_height_mm": payload.page_height_mm,
        "effective_width_mm": round(effective_width, 2),
        "effective_height_mm": round(effective_height, 2),
        "suggested_cols": suggested_cols,
        "suggested_rows": suggested_rows,
        "total_layout_width_mm": round(total_layout_width, 2),
        "total_layout_height_mm": round(total_layout_height, 2),
    }