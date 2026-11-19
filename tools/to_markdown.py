"""Convert resumes or job descriptions (PDF, DOCX, PPTX, XLSX, HTML, URL) to Markdown with MarkItDown.

Use it to import an existing resume library (Phase 0 needs .md files) or to save a JD that
arrived as a PDF, Word file or web page.

Usage:
  python tools/to_markdown.py <file-or-url> [<file-or-url> ...] [-o OUTPUT_DIR]

Each input becomes <OUTPUT_DIR>/<input stem>.md (default OUTPUT_DIR: same folder as the input,
or the current folder for URLs). Existing files are not overwritten unless --force is given.
"""
import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from markitdown import MarkItDown

SUPPORTED = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md", ".csv", ".json", ".xml", ".epub"}


def output_path(src: str, out_dir: Path | None, clashing_stems: set[str]) -> Path:
    if src.startswith(("http://", "https://")):
        parsed = urlparse(src)
        stem = re.sub(r"[^A-Za-z0-9_-]+", "_", (parsed.netloc + parsed.path).strip("/"))[:80] or "page"
        return (out_dir or Path.cwd()) / f"{stem}.md"
    p = Path(src)
    # resume.pdf and resume.docx in one run become resume.pdf.md and resume.docx.md
    name = f"{p.name}.md" if p.stem in clashing_stems else f"{p.stem}.md"
    return (out_dir or p.parent) / name


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="local files or http(s) URLs")
    ap.add_argument("-o", "--output-dir", type=Path)
    ap.add_argument("--force", action="store_true", help="overwrite existing .md files")
    args = ap.parse_args()

    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=True)

    md = MarkItDown()  # built-in converters only: no plugins, no cloud services
    stems = [Path(s).stem for s in args.inputs if not s.startswith(("http://", "https://"))]
    clashing = {s for s in stems if stems.count(s) > 1}
    failures = 0
    for src in args.inputs:
        is_url = src.startswith(("http://", "https://"))
        if not is_url:
            p = Path(src)
            if not p.is_file():
                print(f"skip  {src}: not a file", file=sys.stderr)
                failures += 1
                continue
            if p.suffix.lower() not in SUPPORTED:
                print(f"skip  {src}: unsupported type {p.suffix}", file=sys.stderr)
                continue
            if p.name.startswith("~$"):  # Word lock files
                continue
        dest = output_path(src, args.output_dir, clashing)
        if dest.exists() and not args.force:
            print(f"skip  {src}: {dest} exists (use --force)", file=sys.stderr)
            continue
        try:
            result = md.convert(src)
        except Exception as exc:  # noqa: BLE001 - report and continue with the next file
            print(f"fail  {src}: {exc}", file=sys.stderr)
            failures += 1
            continue
        header = f"<!-- Converted from {src if is_url else Path(src).name} with MarkItDown -->\n\n"
        dest.write_text(header + result.markdown.strip() + "\n", encoding="utf-8")
        print(f"wrote {dest}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
