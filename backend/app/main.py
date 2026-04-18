import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import upload, generate, download, analyze, preview, preview_result

app = FastAPI(title="Kupon Web App API")

frontend_url = os.getenv("https://cg-nomor-layout.vercel.app", "http://localhost:5173")

allowed_origins = [
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Pages", "X-Current-Page"],
)

app.include_router(upload.router)
app.include_router(generate.router)
app.include_router(download.router)
app.include_router(analyze.router)
app.include_router(preview.router)
app.include_router(preview_result.router)


@app.get("/")
def root():
    return {"message": "API jalan bro"}
