"""Convert anything to Markdown with MarkItDown: resumes, job descriptions, slide decks, spreadsheets,
emails, web pages, YouTube talks, scanned PDFs.

Local by default. Features that send your file to an outside service (cloud OCR, image descriptions,
audio transcription, Azure) only run when you pass --allow-cloud.

Usage:
  python tools/to_markdown.py <file | folder | URL | -> [...] [options]

Inputs:
  file      PDF, DOCX, PPTX, XLSX, XLS, MSG (Outlook), HTML, TXT, MD, CSV, JSON, XML, EPUB, ZIP,
            images (JPG/PNG: metadata; text with --ocr or --describe-images), audio (with --allow-cloud)
  folder    every supported file in it (add --recursive for subfolders)
  URL       web page, or a YouTube video (its transcript)
  -         read from stdin; give the type with --stdin-ext (default .pdf)

Output:
  -o DIR    write <name>.md files there (default: next to each input; URLs and stdin: current folder)
  --stdout  print instead of writing files
  --force   overwrite existing .md files

Power features:
  --ocr                   read text from scanned pages and embedded images (markitdown-ocr plugin)
  --describe-images       add an AI description of each image
  --llm-model NAME        vision model for --ocr / --describe-images (default gpt-4o; e.g. llava for Ollama)
  --llm-base-url URL      OpenAI-compatible endpoint; a localhost URL (Ollama, LM Studio) keeps it offline
  --llm-prompt TEXT       custom prompt for OCR / descriptions
  --docintel-endpoint URL Azure Document Intelligence (cloud)
  --cu-endpoint URL       Azure Content Understanding (cloud)
  --plugins               enable any installed third-party MarkItDown plugins
  --keep-data-uris        keep embedded images as data: URIs instead of placeholders
  --allow-cloud           allow the cloud features above
  --list-formats          show which formats and features are installed, then exit

Setup: `npm run setup:py` (local formats) or `npm run setup:py:extras` (everything).
"""
import argparse
import importlib.util
import io
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from markitdown import MarkItDown, StreamInfo

DOCS = {".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".msg", ".html", ".htm", ".txt", ".md", ".csv", ".json",
        ".xml", ".epub", ".zip", ".ipynb", ".rss", ".atom"}
IMAGES = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"}
AUDIO = {".wav", ".mp3", ".m4a", ".mp4"}
SUPPORTED = DOCS | IMAGES | AUDIO

FEATURES = [  # (label, module to probe, install hint)
    ("PDF", "pdfminer", "requirements.txt"),
    ("Word (DOCX)", "mammoth", "requirements.txt"),
    ("PowerPoint (PPTX)", "pptx", "requirements.txt"),
    ("Excel (XLSX)", "openpyxl", "requirements.txt"),
    ("Excel 97-2003 (XLS)", "xlrd", "requirements.txt"),
    ("Outlook (MSG)", "olefile", "requirements.txt"),
    ("Audio transcription (cloud)", "speech_recognition", "requirements-extras.txt"),
    ("YouTube transcripts", "youtube_transcript_api", "requirements-extras.txt"),
    ("Azure Document Intelligence (cloud)", "azure.ai.documentintelligence", "requirements-extras.txt"),
    ("Azure Content Understanding (cloud)", "azure.ai.contentunderstanding", "requirements-extras.txt"),
    ("OCR plugin (--ocr)", "markitdown_ocr", "requirements-extras.txt"),
    ("OpenAI-compatible client (--ocr, --describe-images)", "openai", "requirements-extras.txt"),
    ("MCP server (markitdown-mcp)", "markitdown_mcp", "requirements-extras.txt"),
]


def installed(module: str) -> bool:
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def list_formats() -> None:
    print("Built in: HTML, TXT, Markdown, CSV, JSON, XML, EPUB, ZIP, Jupyter, RSS, image metadata, web pages")
    for label, module, hint in FEATURES:
        print(f"  {'yes' if installed(module) else 'no '}  {label}" + ("" if installed(module) else f"   (install: {hint})"))


def is_local_url(url: str | None) -> bool:
    host = urlparse(url or "").hostname or ""
    return host in {"localhost", "127.0.0.1", "::1"} or host.endswith(".localhost")


def build_converter(args) -> MarkItDown:
    kwargs = {"enable_plugins": bool(args.plugins or args.ocr)}
    if args.ocr or args.describe_images:
        if not installed("openai"):
            sys.exit("--ocr / --describe-images need the extras: npm run setup:py:extras")
        if args.ocr and not installed("markitdown_ocr"):
            sys.exit("--ocr needs the markitdown-ocr plugin: npm run setup:py:extras")
        from openai import OpenAI

        base_url = args.llm_base_url or os.environ.get("OPENAI_BASE_URL")
        api_key = os.environ.get("OPENAI_API_KEY") or ("local" if is_local_url(base_url) else None)
        if not api_key:
            sys.exit("Set OPENAI_API_KEY, or use a local model with --llm-base-url http://localhost:11434/v1")
        kwargs.update(llm_client=OpenAI(base_url=base_url, api_key=api_key), llm_model=args.llm_model)
        if args.llm_prompt:
            kwargs["llm_prompt"] = args.llm_prompt
    if args.docintel_endpoint:
        kwargs["docintel_endpoint"] = args.docintel_endpoint
    if args.cu_endpoint:
        kwargs["cu_endpoint"] = args.cu_endpoint
    return MarkItDown(**kwargs)


def cloud_reasons(args) -> list[str]:
    reasons = []
    if (args.ocr or args.describe_images) and not is_local_url(args.llm_base_url or os.environ.get("OPENAI_BASE_URL")):
        reasons.append("--ocr/--describe-images send images to your LLM provider")
    if args.docintel_endpoint:
        reasons.append("--docintel-endpoint sends files to Azure Document Intelligence")
    if args.cu_endpoint:
        reasons.append("--cu-endpoint sends files to Azure Content Understanding")
    return reasons


def expand(inputs: list[str], recursive: bool) -> list[tuple[str, Path | None]]:
    """Returns (source, base folder) pairs; base is set for files found inside a folder input."""
    out = []
    for src in inputs:
        p = Path(src)
        if src != "-" and not src.startswith(("http://", "https://")) and p.is_dir():
            pattern = "**/*" if recursive else "*"
            for f in sorted(p.glob(pattern)):
                if f.is_file() and f.suffix.lower() in SUPPORTED and not f.name.startswith(("~$", ".")):
                    out.append((str(f), p))
        else:
            out.append((src, None))
    return out


def output_path(src: str, base: Path | None, out_dir: Path | None, clashing: set[str]) -> Path:
    if src == "-":
        return (out_dir or Path.cwd()) / "stdin.md"
    if src.startswith(("http://", "https://")):
        parsed = urlparse(src)
        stem = re.sub(r"[^A-Za-z0-9_-]+", "_", (parsed.netloc + parsed.path + ("_" + parsed.query if parsed.query else "")).strip("/"))
        return (out_dir or Path.cwd()) / f"{stem[:80] or 'page'}.md"
    p = Path(src)
    # resume.pdf and resume.docx in one run become resume.pdf.md and resume.docx.md
    name = f"{p.name}.md" if str(p.with_suffix("")) in clashing else f"{p.stem}.md"
    if out_dir and base:
        return out_dir / p.parent.relative_to(base) / name  # keep folder structure
    return (out_dir or p.parent) / name


def convert_one(md: MarkItDown, src: str, args):
    extra = {"keep_data_uris": True} if args.keep_data_uris else {}
    if src == "-":
        data = sys.stdin.buffer.read()
        ext = args.stdin_ext if args.stdin_ext.startswith(".") else f".{args.stdin_ext}"
        return md.convert_stream(io.BytesIO(data), stream_info=StreamInfo(extension=ext), **extra)
    if src.startswith(("http://", "https://")):
        return md.convert_uri(src, **extra)
    return md.convert_local(src, **extra)  # narrowest API for local files, per MarkItDown's security guidance


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="*", help="files, folders, http(s) URLs, or - for stdin")
    ap.add_argument("-o", "--output-dir", type=Path)
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--recursive", action="store_true")
    ap.add_argument("--stdin-ext", default=".pdf")
    ap.add_argument("--ocr", action="store_true")
    ap.add_argument("--describe-images", action="store_true")
    ap.add_argument("--llm-model", default="gpt-4o")
    ap.add_argument("--llm-base-url")
    ap.add_argument("--llm-prompt")
    ap.add_argument("--docintel-endpoint")
    ap.add_argument("--cu-endpoint")
    ap.add_argument("--plugins", action="store_true")
    ap.add_argument("--keep-data-uris", action="store_true")
    ap.add_argument("--allow-cloud", action="store_true")
    ap.add_argument("--list-formats", action="store_true")
    args = ap.parse_args()

    if args.list_formats:
        list_formats()
        return 0
    if not args.inputs:
        ap.error("give at least one file, folder, URL or -")

    reasons = cloud_reasons(args)
    if reasons and not args.allow_cloud:
        for r in reasons:
            print(f"refused: {r}. Add --allow-cloud if that's OK for this file.", file=sys.stderr)
        return 2
    for r in reasons:
        print(f"note: {r}", file=sys.stderr)

    md = build_converter(args)
    items = expand(args.inputs, args.recursive)
    stems = [str(Path(s).with_suffix("")) for s, _ in items if s != "-" and not s.startswith(("http://", "https://"))]
    clashing = {s for s in stems if stems.count(s) > 1}
    if args.output_dir and not args.stdout:
        args.output_dir.mkdir(parents=True, exist_ok=True)

    failures = written = 0
    for src, base in items:
        is_url = src.startswith(("http://", "https://"))
        if src != "-" and not is_url:
            p = Path(src)
            if not p.is_file():
                print(f"skip  {src}: not a file or folder", file=sys.stderr)
                failures += 1
                continue
            if p.name.startswith("~$"):  # Word lock files
                continue
            if p.suffix.lower() in AUDIO and not args.allow_cloud:
                print(f"skip  {src}: audio transcription uses an online speech service (add --allow-cloud)", file=sys.stderr)
                continue
        dest = output_path(src, base, args.output_dir, clashing)
        if not args.stdout and dest.exists() and not args.force:
            print(f"skip  {src}: {dest} exists (use --force)", file=sys.stderr)
            continue
        try:
            result = convert_one(md, src, args)
        except Exception as exc:  # noqa: BLE001 - report and continue with the next input
            print(f"fail  {src}: {type(exc).__name__}: {str(exc).splitlines()[0] if str(exc) else ''}", file=sys.stderr)
            failures += 1
            continue
        body = result.markdown.strip() + "\n"
        if args.stdout:
            sys.stdout.write(body)
            continue
        label = "stdin" if src == "-" else (src if is_url else Path(src).name)
        title = f" | title: {result.title}" if getattr(result, "title", None) else ""
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(f"<!-- Converted from {label} with MarkItDown{title} -->\n\n{body}", encoding="utf-8")
        written += 1
        print(f"wrote {dest}")
    if not args.stdout and len(items) > 1:
        print(f"{written} converted, {failures} failed", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
