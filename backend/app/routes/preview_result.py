from pathlib import Path

import fitz
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = BASE_DIR / "outputs"


@router.get("/preview-result/{job_id}/{filename}")
def preview_result_page(job_id: str, filename: str, page: int = 1):
    file_path = OUTPUT_DIR / job_id / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File output tidak ditemukan")

    doc = fitz.open(str(file_path))
    if len(doc) == 0:
        raise HTTPException(status_code=400, detail="PDF output kosong")

    total_pages = len(doc)

    if page < 1 or page > total_pages:
        raise HTTPException(status_code=400, detail="Nomor halaman tidak valid")

    target_page = doc[page - 1]
    pix = target_page.get_pixmap(dpi=150, alpha=False)
    image_bytes = pix.tobytes("png")

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "X-Total-Pages": str(total_pages),
            "X-Current-Page": str(page),
        },
    )