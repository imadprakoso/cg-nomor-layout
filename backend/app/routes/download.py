import os
import zipfile
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = BASE_DIR / "outputs"


@router.get("/download/{job_id}/{filename}")
def download_file(job_id: str, filename: str):
    file_path = OUTPUT_DIR / job_id / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/pdf",
    )


@router.get("/download-zip/{job_id}")
def download_zip(job_id: str):
    job_folder = OUTPUT_DIR / job_id

    if not job_folder.exists() or not job_folder.is_dir():
        raise HTTPException(status_code=404, detail="Folder output tidak ditemukan")

    pdf_files = list(job_folder.glob("*.pdf"))
    if not pdf_files:
        raise HTTPException(status_code=404, detail="Tidak ada file PDF untuk di-zip")

    temp_dir = tempfile.gettempdir()
    zip_path = os.path.join(temp_dir, f"{job_id}.zip")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for pdf_file in pdf_files:
            zipf.write(pdf_file, arcname=pdf_file.name)

    return FileResponse(
        path=zip_path,
        filename=f"{job_id}.zip",
        media_type="application/zip",
    )