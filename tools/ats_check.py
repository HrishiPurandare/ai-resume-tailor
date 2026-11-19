"""ATS parse check: can a text extractor read back everything in the resume?

Applicant tracking systems pull plain text out of the uploaded DOCX or PDF before they match
keywords. This script does the same with MarkItDown and checks that every name, contact item,
heading, job title, company, date, bullet, skill and certification from resume.json survives
extraction, in both files.

Usage:
  python tools/ats_check.py <resume.json> <output basename> [--min 100] [--keywords JD.md]

  <output basename> is the path without extension, e.g. applications/X/Jane_Doe_Resume
  --keywords  optional file with one keyword per line (or a JD.md); reports which keywords
              appear in the extracted text, for a quick keyword-coverage view.

Exit code 1 if either file scores below --min percent (default 100).
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

from markitdown import MarkItDown

HEADINGS = ["Professional Summary", "Technical Skills", "Professional Experience", "Education", "Certifications"]


def norm(text: str) -> str:
    """Lowercase, unify dashes/quotes, drop markdown symbols and collapse whitespace."""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("–", "-").replace("—", "-").replace("‑", "-")
    text = text.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"[*_#`>|•●▪◦]", " ", text)
    text = re.sub(r"-\s*\n\s*", "-", text)  # rejoin words split across lines at a hyphen
    return re.sub(r"\s+", " ", text).strip().lower()


def expected_items(r: dict) -> list[tuple[str, str]]:
    items = [("name", r["name"]), ("headline", r["headline"])]
    for line in r["contact"]:
        items += [("contact", part.strip()) for part in line.split("|") if part.strip()]
    items += [("summary", s.strip()) for s in re.split(r"(?<=\.)\s+", r["summary"]) if s.strip()]
    for k, v in r["skills"]:
        items += [("skill category", k), ("skills", v)]
    for e in r["experience"]:
        items += [("title", e["title"]), ("company", e["company"]), ("dates", e["dates"])]
        items += [("bullet", b) for b in e["bullets"]]
    for name, desc in r.get("projects", []):
        items += [("project", name), ("project", desc)]
    items += [("education", x) for x in r["education"]]
    items += [("certification", x) for x in r["certifications"]]
    headings = HEADINGS + (["Projects"] if r.get("projects") else [])
    items += [("heading", h) for h in headings]
    return items


def keywords_from(path: Path) -> list[str]:
    lines = [l.strip(" -*\t") for l in path.read_text(encoding="utf-8").splitlines()]
    return [l for l in lines if 0 < len(l) <= 40 and not l.startswith("#")]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("resume_json", type=Path)
    ap.add_argument("base", help="output basename without extension")
    ap.add_argument("--min", type=float, default=100.0, help="minimum %% of items found (default 100)")
    ap.add_argument("--keywords", type=Path, help="optional keyword list or JD file")
    args = ap.parse_args()

    r = json.loads(args.resume_json.read_text(encoding="utf-8"))
    items = expected_items(r)
    md = MarkItDown()
    ok = True

    for ext in ("docx", "pdf"):
        f = Path(f"{args.base}.{ext}")
        if not f.is_file():
            print(f"[{ext.upper()}] missing: {f}")
            ok = False
            continue
        text = norm(md.convert(str(f)).markdown)
        missing = [(kind, val) for kind, val in items if norm(val) not in text]
        score = 100 * (len(items) - len(missing)) / len(items)
        status = "PASS" if score >= args.min else "FAIL"
        print(f"[{ext.upper()}] {status}  {len(items) - len(missing)}/{len(items)} items readable ({score:.1f}%)")
        for kind, val in missing:
            print(f"    not found ({kind}): {val[:90]}")
        ok &= score >= args.min

        if args.keywords:
            kws = keywords_from(args.keywords)
            hits = [k for k in kws if norm(k) in text]
            print(f"    keywords present: {len(hits)}/{len(kws)}")
            for k in kws:
                if k not in hits:
                    print(f"      absent: {k}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
