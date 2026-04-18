import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState("");
  const [result, setResult] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedPreviewFile, setSelectedPreviewFile] = useState("");
  const [resultPreviewUrl, setResultPreviewUrl] = useState("");
  const [resultPreviewPage, setResultPreviewPage] = useState(1);
  const [resultPreviewTotalPages, setResultPreviewTotalPages] = useState(1);

  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const [uploadStatus, setUploadStatus] = useState("");
  const [generateStatus, setGenerateStatus] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    page_width_mm: 325,
    page_height_mm: 485,
    cols: 3,
    rows: 11,
    crop_mark_extra_mm: 5,
    kupon_per_file: 500,
    use_cropmark: true,
  });

  useEffect(() => {
    return () => {
      if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    };
  }, [resultPreviewUrl]);

  const validateForm = () => {
    if (!fileId) return "Upload file PDF dulu bro.";
    if (form.cols < 1) return "Kolom minimal 1";
    if (form.rows < 1) return "Baris minimal 1";
    if (form.kupon_per_file < 1) return "Kupon per file minimal 1";
    if (form.page_width_mm <= 0 || form.page_height_mm <= 0) {
      return "Ukuran kertas tidak valid";
    }
    if (form.crop_mark_extra_mm < 0) {
      return "Panjang cropmark tidak boleh minus";
    }
    return null;
  };

  const validationError = validateForm();
  const isGenerateDisabled =
    isUploading || isGenerating || isDownloadingZip || !!validationError;

  const getStatusClass = (message) => {
    const text = String(message || "").toLowerCase();
    if (text.includes("berhasil")) {
      return "bg-emerald-50 border border-emerald-200 text-emerald-700";
    }
    if (
      text.includes("gagal") ||
      text.includes("pilih") ||
      text.includes("tidak valid")
    ) {
      return "bg-red-50 border border-red-200 text-red-700";
    }
    return "bg-blue-50 border border-blue-200 text-blue-700";
  };

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const buttonClass =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAnalyze = async (uploadedFileId) => {
    try {
      const res = await axios.post(`${API_BASE}/analyze`, {
        file_id: uploadedFileId,
        page_width_mm: 325,
        page_height_mm: 485,
        crop_mark_extra_mm: 5,
        outer_gap_mm: 3,
      });

      setAnalysis(res.data);

      setForm((prev) => ({
        ...prev,
        page_width_mm: res.data.paper_width_mm,
        page_height_mm: res.data.paper_height_mm,
        cols: res.data.suggested_cols,
        rows: res.data.suggested_rows,
      }));
    } catch (err) {
      console.error("ANALYZE ERROR:", err);
    }
  };

  const handleUpload = async () => {
    try {
      if (!file) {
        setUploadStatus("Pilih file PDF dulu bro.");
        return;
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setUploadStatus("File harus PDF bro.");
        return;
      }

      setIsUploading(true);
      setUploadStatus("Uploading file...");
      setGenerateStatus("");
      setDownloadStatus("");
      setError("");
      setResult(null);
      setAnalysis(null);
      setPreviewUrl("");
      setSelectedPreviewFile("");
      setResultPreviewPage(1);
      setResultPreviewTotalPages(1);
      setResultPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFileId(res.data.file_id);
      setUploadInfo(res.data);
      setUploadStatus("Upload berhasil bro.");
      setPreviewUrl(`${API_BASE}/preview/${res.data.file_id}`);
      await handleAnalyze(res.data.file_id);
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      setUploadStatus(
        err?.response?.data?.detail || err?.message || "Upload gagal"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const loadResultPreview = async (jobId, filename, page = 1) => {
    try {
      const response = await axios.get(
        `${API_BASE}/preview-result/${jobId}/${filename}?page=${page}`,
        { responseType: "blob" }
      );

      const imageUrl = URL.createObjectURL(response.data);

      setResultPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return imageUrl;
      });

      setResultPreviewPage(Number(response.headers["x-current-page"] || page));
      setResultPreviewTotalPages(
        Number(response.headers["x-total-pages"] || 1)
      );
      setSelectedPreviewFile(filename);
    } catch (err) {
      console.error("PREVIEW RESULT ERROR:", err);
    }
  };

  const handleGenerate = async () => {
    try {
      const currentValidationError = validateForm();

      if (currentValidationError) {
        setError(currentValidationError);
        return;
      }

      setIsGenerating(true);
      setGenerateStatus("Generating layout...");
      setDownloadStatus("");
      setError("");
      setResult(null);
      setSelectedPreviewFile("");
      setResultPreviewPage(1);
      setResultPreviewTotalPages(1);
      setResultPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });

      const res = await axios.post(`${API_BASE}/generate`, {
        file_id: fileId,
        ...form,
      });

      setResult(res.data);
      setGenerateStatus("Generate berhasil bro.");

      if (res.data.files && res.data.files.length > 0) {
        await loadResultPreview(res.data.job_id, res.data.files[0], 1);
      }
    } catch (err) {
      console.error("GENERATE ERROR:", err);
      setGenerateStatus(
        err?.response?.data?.detail || err?.message || "Generate gagal"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      if (!result?.job_id) {
        setDownloadStatus("Belum ada job untuk di-download.");
        return;
      }

      setIsDownloadingZip(true);
      setDownloadStatus("Preparing ZIP download...");

      const response = await axios.get(
        `${API_BASE}/download-zip/${result.job_id}`,
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.job_id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
      setDownloadStatus("ZIP berhasil di-download bro.");
    } catch (err) {
      console.error("ZIP DOWNLOAD ERROR:", err);
      setDownloadStatus(
        err?.response?.data?.detail || err?.message || "Download ZIP gagal"
      );
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handlePrevPreviewPage = async () => {
    if (!result || !selectedPreviewFile || resultPreviewPage <= 1) return;
    await loadResultPreview(
      result.job_id,
      selectedPreviewFile,
      resultPreviewPage - 1
    );
  };

  const handleNextPreviewPage = async () => {
    if (
      !result ||
      !selectedPreviewFile ||
      resultPreviewPage >= resultPreviewTotalPages
    ) return;
    await loadResultPreview(
      result.job_id,
      selectedPreviewFile,
      resultPreviewPage + 1
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Kupon Web App</h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload PDF, generate layout, preview hasil, dan download file siap potong.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">1. Upload PDF</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Upload file PDF kupon yang mau diproses.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={isUploading || isGenerating || isDownloadingZip}
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                />

                <button
                  onClick={handleUpload}
                  disabled={isUploading || isGenerating || isDownloadingZip}
                  className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-700`}
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </div>

              {uploadInfo && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                  <div>
                    <span className="font-semibold">File ID:</span>{" "}
                    <span className="break-all">{uploadInfo.file_id}</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold">Filename:</span>{" "}
                    {uploadInfo.filename}
                  </div>
                </div>
              )}

              {uploadStatus && (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${getStatusClass(uploadStatus)}`}>
                  {uploadStatus}
                </div>
              )}

              {analysis && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    Hasil Analyze Otomatis
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-slate-500">Ukuran Kupon Asli</div>
                      <div className="font-medium text-slate-900">
                        {analysis.kupon_width_mm} × {analysis.kupon_height_mm} mm
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Saran Layout</div>
                      <div className="font-medium text-slate-900">
                        {analysis.suggested_cols} kolom × {analysis.suggested_rows} baris
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Kertas</div>
                      <div className="font-medium text-slate-900">
                        {analysis.paper_width_mm} × {analysis.paper_height_mm} mm
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-500">Area Efektif</div>
                      <div className="font-medium text-slate-900">
                        {analysis.effective_width_mm} × {analysis.effective_height_mm} mm
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewUrl && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    Preview Halaman Pertama PDF
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img
                      src={previewUrl}
                      alt="Preview halaman pertama PDF"
                      className="max-h-[500px] w-full object-contain bg-white"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">2. Setting Generate</h2>
                <p className="mt-1 text-sm text-slate-500">
                  A3+ portrait dikunci otomatis. Kolom dan baris disarankan otomatis setelah upload.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Lebar Kertas (mm)</label>
                  <input
                    type="number"
                    value={form.page_width_mm}
                    disabled
                    className={`${inputClass} bg-slate-100`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Tinggi Kertas (mm)</label>
                  <input
                    type="number"
                    value={form.page_height_mm}
                    disabled
                    className={`${inputClass} bg-slate-100`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Kolom
                    <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Auto
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.cols}
                    disabled={isGenerating || isDownloadingZip}
                    onChange={(e) => handleChange("cols", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Baris
                    <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Auto
                    </span>
                  </label>
                  <input
                    type="number"
                    value={form.rows}
                    disabled={isGenerating || isDownloadingZip}
                    onChange={(e) => handleChange("rows", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Panjang Cropmark (mm)</label>
                  <input
                    type="number"
                    value={form.crop_mark_extra_mm}
                    disabled={isGenerating || isDownloadingZip}
                    onChange={(e) => handleChange("crop_mark_extra_mm", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Kupon per File</label>
                  <input
                    type="number"
                    value={form.kupon_per_file}
                    disabled={isGenerating || isDownloadingZip}
                    onChange={(e) => handleChange("kupon_per_file", Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.use_cropmark}
                      disabled={isGenerating || isDownloadingZip}
                      onChange={(e) => handleChange("use_cropmark", e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Pakai Cropmark
                  </label>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl bg-red-100 p-3 text-red-700">
                  ⚠️ {error}
                </div>
              )}

              {validationError && !isGenerating && (
                <p className="mt-3 text-sm text-gray-500">
                  {validationError}
                </p>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
                className={`mt-6 px-4 py-2 rounded-xl text-white ${isGenerateDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
                  }`}
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>

              {generateStatus && (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${getStatusClass(generateStatus)}`}>
                  {generateStatus}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">3. Hasil Generate</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Download file hasil satu per satu, ZIP semua, atau preview halaman output.
                </p>
              </div>

              {!result && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada hasil bro.
                </div>
              )}

              {result && (
                <div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <div className="font-semibold text-slate-900">Job ID</div>
                      <div className="mt-1 break-all text-slate-600">{result.job_id}</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <div className="font-semibold text-slate-900">Total Input Pages</div>
                      <div className="mt-1 text-slate-600">{result.total_input_pages}</div>
                    </div>
                  </div>

                  {result.files.length > 0 && (
                    <div className="mt-6">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Pilih File Preview
                      </label>
                      <select
                        value={selectedPreviewFile}
                        onChange={async (e) => {
                          const filename = e.target.value;
                          await loadResultPreview(result.job_id, filename, 1);
                        }}
                        className={inputClass}
                      >
                        {result.files.map((filename) => (
                          <option key={filename} value={filename}>
                            {filename}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {resultPreviewUrl && (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Preview Hasil Generate
                          </div>
                          <div className="text-xs text-slate-500">
                            {selectedPreviewFile} • Halaman {resultPreviewPage} / {resultPreviewTotalPages}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handlePrevPreviewPage}
                            disabled={resultPreviewPage <= 1}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Prev
                          </button>

                          <button
                            onClick={handleNextPreviewPage}
                            disabled={resultPreviewPage >= resultPreviewTotalPages}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img
                          src={resultPreviewUrl}
                          alt="Preview hasil generate"
                          className="max-h-[700px] w-full object-contain bg-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <button
                      onClick={handleDownloadZip}
                      disabled={isDownloadingZip}
                      className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-700`}
                    >
                      {isDownloadingZip ? "Downloading ZIP..." : "Download All (.zip)"}
                    </button>
                  </div>

                  {downloadStatus && (
                    <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${getStatusClass(downloadStatus)}`}>
                      {downloadStatus}
                    </div>
                  )}

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold">File Output</h3>

                    <div className="mt-3 space-y-3">
                      {result.files.map((filename) => (
                        <div
                          key={filename}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="break-all text-sm text-slate-700">{filename}</div>

                          <a
                            href={`${API_BASE}/download/${result.job_id}/${filename}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      Lihat response JSON
                    </summary>
                    <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Ringkasan</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span>Ukuran Kertas</span>
                  <span className="font-medium text-slate-900">
                    {form.page_width_mm} × {form.page_height_mm} mm
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Grid</span>
                  <span className="font-medium text-slate-900">
                    {form.cols} × {form.rows}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Cropmark</span>
                  <span className="font-medium text-slate-900">
                    {form.use_cropmark ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Panjang Cropmark</span>
                  <span className="font-medium text-slate-900">
                    {form.crop_mark_extra_mm} mm
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Kupon / File</span>
                  <span className="font-medium text-slate-900">
                    {form.kupon_per_file}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Tips</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                <li>Upload PDF kupon asli sebelum generate.</li>
                <li>Saran kolom dan baris akan terisi otomatis.</li>
                <li>Generate dulu, lalu cek preview hasil tanpa download.</li>
                <li>Gunakan ZIP kalau file output lebih dari satu.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
