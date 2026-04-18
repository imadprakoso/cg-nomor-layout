import os
from math import ceil
from io import BytesIO

import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import black
from PyPDF2 import PdfMerger, PdfReader


def generate_coupon_layout(
    input_pdf: str,
    output_folder: str,
    page_width_mm: float = 485,
    page_height_mm: float = 325,
    cols: int = 5,
    rows: int = 5,
    crop_mark_extra_mm: float = 5,
    kupon_per_file: int = 500,
    use_cropmark: bool = True,
):
    doc = fitz.open(input_pdf)

    if len(doc) == 0:
        raise ValueError("PDF kosong")

    # ukuran asli kupon dari halaman pertama
    kupon_width_pt = doc[0].rect.width
    kupon_height_pt = doc[0].rect.height
    kupon_width_mm = kupon_width_pt * 25.4 / 72
    kupon_height_mm = kupon_height_pt * 25.4 / 72

    total_coupons_width = cols * kupon_width_mm
    total_coupons_height = rows * kupon_height_mm

    if total_coupons_width > page_width_mm or total_coupons_height > page_height_mm:
        raise ValueError("Ukuran grid kupon melebihi ukuran kertas")

    x_margin = (page_width_mm - total_coupons_width) / 2
    y_margin = (page_height_mm - total_coupons_height) / 2

    os.makedirs(output_folder, exist_ok=True)

    def draw_cropmark(c):
        mark_len = crop_mark_extra_mm * mm   # panjang cropmark
        gap = 3 * mm                         # jarak cropmark dari design

        c.setStrokeColor(black)
        c.setLineWidth(0.5)

        start_x = x_margin * mm
        start_y = (page_height_mm - y_margin - total_coupons_height) * mm
        end_x = start_x + total_coupons_width * mm
        end_y = start_y + total_coupons_height * mm

        # ===== OUTER VERTICAL MARKS =====
        # hanya mark atas dan bawah untuk semua garis kolom
        for i in range(cols + 1):
            x = start_x + i * kupon_width_mm * mm

            # atas
            c.line(x, start_y - gap - mark_len, x, start_y - gap)

            # bawah
            c.line(x, end_y + gap, x, end_y + gap + mark_len)

        # ===== OUTER HORIZONTAL MARKS =====
        # hanya mark kiri dan kanan untuk semua garis baris
        for j in range(rows + 1):
            y = start_y + j * kupon_height_mm * mm

            # kiri
            c.line(start_x - gap - mark_len, y, start_x - gap, y)

            # kanan
            c.line(end_x + gap, y, end_x + gap + mark_len, y)

        # NOTE:
        # Tidak ada inner cross mark di tengah layout.
        # Ini sengaja dihilangkan agar cropmark tidak masuk ke area design,
        # sesuai request final: hanya cropmark luar yang dipertahankan.

    total_kupon = len(doc)
    batches = ceil(total_kupon / kupon_per_file)
    generated_files = []

    for batch in range(batches):
        start_index = batch * kupon_per_file
        end_index = min(start_index + kupon_per_file, total_kupon)
        total_this_batch = end_index - start_index
        positions_per_page = cols * rows
        pages_needed = ceil(total_this_batch / positions_per_page)

        buffers = [BytesIO() for _ in range(pages_needed)]
        canvases = [
            canvas.Canvas(buf, pagesize=(page_width_mm * mm, page_height_mm * mm))
            for buf in buffers
        ]

        counter = start_index

        for pos in range(positions_per_page):
            row = pos // cols
            col = pos % cols

            x = (x_margin + col * kupon_width_mm) * mm
            y = (page_height_mm - y_margin - (row + 1) * kupon_height_mm) * mm

            for page_num in range(pages_needed):
                if counter >= end_index:
                    break

                page = doc.load_page(counter)
                pix = page.get_pixmap(dpi=200)
                temp_img = os.path.join(output_folder, f"temp_{counter+1:06}.png")
                pix.save(temp_img)

                canvases[page_num].drawImage(
                    temp_img,
                    x,
                    y,
                    width=kupon_width_mm * mm,
                    height=kupon_height_mm * mm,
                    preserveAspectRatio=True,
                    mask="auto",
                )

                os.remove(temp_img)
                counter += 1

        for c in canvases:
            if use_cropmark:
                draw_cropmark(c)
            c.showPage()
            c.save()

        temp_paths = []
        for i, buf in enumerate(buffers):
            temp_pdf = os.path.join(output_folder, f"temp_batch_{batch+1}_page_{i+1}.pdf")
            with open(temp_pdf, "wb") as f:
                f.write(buf.getvalue())
            temp_paths.append(temp_pdf)

        merger = PdfMerger()
        for temp_pdf in temp_paths:
            merger.append(PdfReader(temp_pdf, "rb"))

        output_filename = f"Kupon_{start_index+1:06}-{end_index:06}.pdf"
        output_path = os.path.join(output_folder, output_filename)
        merger.write(output_path)
        merger.close()

        for temp_pdf in temp_paths:
            os.remove(temp_pdf)

        generated_files.append(output_filename)

    return {
        "success": True,
        "generated_files": generated_files,
        "output_folder": output_folder,
        "total_input_pages": total_kupon,
    }
