import os
import re
from dataclasses import dataclass

import olefile
from markitdown import MarkItDown
from utils import truncate_text
from config import (
    OCR_MIN_CONTENT_CHARS,
    OCR_FIRST_PAGES,
    OCR_LAST_PAGES,
    OCR_MIN_CHARS_THRESHOLD,
    OCR_FIRST_CHARS,
    OCR_LAST_CHARS,
    OCR_DPI,
)


@dataclass
class ContentResult:
    """Result of content extraction, including OCR metadata."""

    text: str
    was_ocr: bool = False
    ocr_text: str = ""


# File extensions eligible for OCR fallback
OCR_ELIGIBLE_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png")


def extract_text_from_doc(file_path: str) -> str:
    """Extract text content from .doc and .dot files.

    Args:
        file_path (str): Path to the document file

    Returns:
        str: Extracted text content
    """
    if not olefile.isOleFile(file_path):
        return ""

    ole = olefile.OleFileIO(file_path)
    streams = ole.listdir()

    if ["WordDocument"] not in streams:
        return ""

    # Read the WordDocument stream
    word_stream = ole.openstream("WordDocument")
    data = word_stream.read()

    text = re.findall(b"[\x20-\x7e\r\n]{4,}", data)

    # Decode and join the extracted text
    decoded_text = [t.decode("ascii", errors="ignore") for t in text]
    result = "\n".join(
        line
        for i, line in enumerate(decoded_text)
        if i == 0 or line.strip() != decoded_text[i - 1].strip()
    )

    result = re.sub(r"\s{2,}", " ", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    ole.close()
    return result.strip()


def extract_text_from_markdown(file_path: str, path: str) -> str:
    """Extract text content from markdown supported files.

    Args:
        file_path (str): Full path to the file
        path (str): Original path relative to working directory

    Returns:
        str: Extracted text content
    """
    md = MarkItDown()
    result = md.convert(file_path)
    return f"Content of '{path}':\n{truncate_text(result.text_content)}"


def extract_text_from_plaintext(file_path: str, path: str) -> str:
    """Extract text content from plain text files.

    Args:
        file_path (str): Full path to the file
        path (str): Original path relative to working directory

    Returns:
        str: Extracted text content or error message
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            return f"Content of '{path}':\n{content}"
    except Exception as e:
        return f"Error reading file '{path}': {str(e)}"


def ocr_image(file_path: str) -> str:
    """OCR an image file using Tesseract.

    Args:
        file_path (str): Path to the image file

    Returns:
        str: Extracted text from OCR
    """
    import pytesseract
    from PIL import Image

    try:
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        return f"OCR error: {str(e)}"


def extract_pdf_with_ocr(file_path: str) -> tuple[str, bool]:
    """Extract text from a PDF per page, using OCR on pages with insufficient text.

    Uses PyMuPDF for native text extraction. For pages where native extraction
    yields < OCR_MIN_CONTENT_CHARS characters, renders the page to an image
    at OCR_DPI and OCRs with Tesseract.

    Processes first OCR_FIRST_PAGES + last OCR_LAST_PAGES pages (no overlap).

    Args:
        file_path (str): Path to the PDF file

    Returns:
        tuple[str, bool]: (extracted_text, was_any_page_ocrd)
    """
    import fitz
    import pytesseract
    from PIL import Image
    import io

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        return f"Error opening PDF: {str(e)}", False

    total_pages = doc.page_count
    was_ocr = False

    # Determine which pages to process (avoid overlap)
    first_count = min(OCR_FIRST_PAGES, total_pages)
    first_indices = list(range(first_count))

    last_start = max(total_pages - OCR_LAST_PAGES, first_count)
    last_indices = list(range(last_start, total_pages))

    page_indices = first_indices + last_indices
    page_texts = []

    for page_idx in page_indices:
        page = doc[page_idx]

        # Try native text extraction first
        page_text = page.get_text().strip()

        if len(page_text) < OCR_MIN_CONTENT_CHARS:
            # Page has insufficient text — render to image and OCR
            try:
                pix = page.get_pixmap(dpi=OCR_DPI)
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))
                ocr_text = pytesseract.image_to_string(image).strip()
                if ocr_text:
                    page_text = ocr_text
                    was_ocr = True
            except Exception:
                pass

        if page_text:
            page_texts.append(f"--- Page {page_idx + 1} ---\n{page_text}")

    doc.close()

    full_text = "\n\n".join(page_texts)

    # Truncate if needed: keep first N + last M chars
    if len(full_text) > OCR_MIN_CHARS_THRESHOLD:
        full_text = full_text[:OCR_FIRST_CHARS] + "\n...\n" + full_text[-OCR_LAST_CHARS:]

    return full_text, was_ocr


def get_content(working_directory: str, path: str) -> ContentResult:
    """Read and return the content of a file, with OCR fallback for images/PDFs.

    First attempts normal text extraction. If the result has < OCR_MIN_CONTENT_CHARS
    and the file is an image or PDF, falls back to OCR via Tesseract.

    Args:
        working_directory (str): Base directory where operations are performed
        path (str): Path to the file, relative to working_directory

    Returns:
        ContentResult: Extracted content with OCR metadata
    """
    markitdown_supported_extensions = (
        ".pptx",
        ".docx",
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
    )
    word_supported_extensions = (".doc", ".dot")

    full_path = os.path.join(working_directory, path)

    if not os.path.exists(full_path):
        return ContentResult(text=f"Path '{path}' does not exist")

    if not os.path.isfile(full_path):
        return ContentResult(text=f"Path '{path}' is not a file")

    file_ext = os.path.splitext(full_path)[1].lower()

    # Non-OCR-eligible files: extract normally
    if file_ext in word_supported_extensions:
        return ContentResult(text=extract_text_from_doc(full_path))

    if file_ext not in markitdown_supported_extensions:
        return ContentResult(text=extract_text_from_plaintext(full_path, path))

    # MarkItDown-supported files: try normal extraction first
    raw_content = extract_text_from_markdown(full_path, path)

    # Strip the prefix to measure actual content
    prefix = f"Content of '{path}':\n"
    content_body = raw_content[len(prefix):] if raw_content.startswith(prefix) else raw_content

    # Check if we have enough text
    if len(content_body.strip()) >= OCR_MIN_CONTENT_CHARS:
        return ContentResult(text=raw_content)

    # Insufficient text — try OCR if eligible
    if file_ext not in OCR_ELIGIBLE_EXTENSIONS:
        return ContentResult(text=raw_content)

    if file_ext == ".pdf":
        ocr_text, was_ocr = extract_pdf_with_ocr(full_path)
        if was_ocr and ocr_text.strip():
            return ContentResult(
                text=f"Content of '{path}':\n{ocr_text}",
                was_ocr=True,
                ocr_text=ocr_text,
            )
        return ContentResult(text=raw_content)

    # Image files (.jpg, .jpeg, .png)
    ocr_text = ocr_image(full_path)
    if ocr_text and not ocr_text.startswith("OCR error") and len(ocr_text.strip()) > 0:
        return ContentResult(
            text=f"Content of '{path}':\n{ocr_text}",
            was_ocr=True,
            ocr_text=ocr_text,
        )

    return ContentResult(text=raw_content)
