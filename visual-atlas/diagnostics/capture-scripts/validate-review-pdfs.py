from pathlib import Path
import json
from pypdf import PdfReader

ROOT = Path("/Users/haewonkim/.codex-fabric/runs/stockledger/stockledger-prod-c16-authoring-config-error-responsive-fix-v2/visual-atlas")
checks = []
for filename, expected_size in [("review-desktop.pdf", (1560, 1000)), ("review-mobile.pdf", (470, 940))]:
    reader = PdfReader(str(ROOT / filename))
    if len(reader.pages) != 10:
        raise ValueError(f"{filename} should contain 10 pages, found {len(reader.pages)}")
    for index in (0, 4, 5, 9):
        page = reader.pages[index]
        actual_size = (float(page.mediabox.width), float(page.mediabox.height))
        if actual_size != expected_size:
            raise ValueError(f"Unexpected page dimensions in {filename} page {index + 1}: {actual_size}")
        xobjects = page.get("/Resources").get("/XObject").get_object()
        image_count = sum(1 for obj in xobjects.values() if obj.get_object().get("/Subtype") == "/Image")
        if image_count != 1:
            raise ValueError(f"Expected one lossless screenshot per page in {filename} page {index + 1}")
    checks.append({"file": filename, "pages": len(reader.pages), "pageSize": expected_size, "representativePagesVerified": [1, 5, 6, 10], "oneScreenshotImagePerPage": True})
print(json.dumps({"result": "PASS", "pdfs": checks}, separators=(",", ":")))
