from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"


@router.get("/preview/{file_id}")
def preview_first_page(file_id: str):
    matched_files = list(UPLOAD_DIR.glob(f"{file_id}.*"))

    if not matched_files:
        raise HTTPException(status_code=404, detail="File upload tidak ditemukan")

    input_pdf = str(matched_files[0])

    doc = fitz.open(input_pdf)
    if len(doc) == 0:
        raise HTTPException(status_code=400, detail="PDF kosong")

    page = doc[0]

    # render halaman pertama jadi image PNG
    pix = page.get_pixmap(dpi=150, alpha=False)
    image_bytes = pix.tobytes("png")

    return Response(content=image_bytes, media_type="image/png")