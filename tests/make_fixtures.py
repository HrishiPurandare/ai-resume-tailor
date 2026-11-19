"""Creates small test files in every local format MarkItDown supports, all with known text.

Usage: python tests/make_fixtures.py <output dir>
Each file contains the phrase "FIXTURE <FORMAT>" so the test can check it was read.
"""
import csv
import json
import sys
import zipfile
from pathlib import Path

out = Path(sys.argv[1])
(out / "nested").mkdir(parents=True, exist_ok=True)

(out / "job.html").write_text(
    "<html><head><title>QA Role</title></head><body><h1>FIXTURE HTML</h1><ul><li>Playwright</li></ul></body></html>",
    encoding="utf-8",
)
(out / "notes.txt").write_text("FIXTURE TXT\nPlain text job notes.\n", encoding="utf-8")
(out / "data.json").write_text(json.dumps({"title": "FIXTURE JSON", "skills": ["Python"]}), encoding="utf-8")
with open(out / "skills.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([["Skill", "Years"], ["FIXTURE CSV", "5"]])
(out / "nested" / "deep.html").write_text("<p>FIXTURE NESTED</p>", encoding="utf-8")
with zipfile.ZipFile(out / "bundle.zip", "w") as z:
    z.writestr("inside.txt", "FIXTURE ZIP")

from pptx import Presentation  # noqa: E402  (installed with requirements.txt)

deck = Presentation()
slide = deck.slides.add_slide(deck.slide_layouts[1])
slide.shapes.title.text = "FIXTURE PPTX"
slide.placeholders[1].text = "Role: Senior QA Engineer"
deck.save(out / "deck.pptx")

from openpyxl import Workbook  # noqa: E402

wb = Workbook()
ws = wb.active
ws.title = "Skills"
ws.append(["Skill", "Level"])
ws.append(["FIXTURE XLSX", "Expert"])
wb.save(out / "matrix.xlsx")

(out / "talk.mp3").write_bytes(b"ID3")  # not real audio: only used to test the --allow-cloud guard

print(f"fixtures written to {out}")
