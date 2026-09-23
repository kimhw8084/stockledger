from pathlib import Path
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from PIL import Image

ROOT = Path("/Users/haewonkim/.codex-fabric/runs/stockledger/stockledger-prod-c16-authoring-config-lawbook-v1/visual-atlas")
SURFACES = ["eye-composer", "journal-composer", "recipe-builder", "logic-registry", "notification-confirmation"]
LOCALES = [("en", "EN"), ("ko", "KO")]

def create_review(name: str, profile: str, page_size: tuple[int, int], image_size: tuple[int, int], origin: tuple[int, int]) -> None:
    target = ROOT / name
    pdf = canvas.Canvas(str(target), pagesize=page_size, pageCompression=1)
    pdf.setTitle(f"StockLedger CHG-199 {profile} Surface Review")
    pdf.setAuthor("StockLedger Project OS Build Evidence")
    for locale, label in LOCALES:
        for surface in SURFACES:
            image_path = ROOT / "captures" / "canonical" / locale / profile / f"{surface}.png"
            with Image.open(image_path) as image:
                if image.size != image_size:
                    raise ValueError(f"Unexpected image dimensions for {image_path}: {image.size}")
            x, y = origin
            pdf.setFillColorRGB(0.08, 0.11, 0.16)
            pdf.setFont("Helvetica-Bold", 15)
            pdf.drawString(x, page_size[1] - 24, f"CHG-199 Review | {surface} | {label} | {profile}")
            pdf.setFillColorRGB(0.31, 0.36, 0.43)
            pdf.setFont("Helvetica", 8)
            pdf.drawString(x, page_size[1] - 38, "Candidate 48aef5d8be21e83a95d299a78da7ab61557006ec | Golden UI v2 | awaiting independent pixel audit")
            pdf.drawImage(ImageReader(str(image_path)), x, y, width=image_size[0], height=image_size[1], preserveAspectRatio=True, mask="auto")
            pdf.setFillColorRGB(0.31, 0.36, 0.43)
            pdf.setFont("Helvetica", 8)
            pdf.drawString(x, 10, f"{surface} | {label} | {profile}")
            pdf.showPage()
    pdf.save()

create_review("review-desktop.pdf", "desktop-1440x900", (1560, 1000), (1440, 900), (60, 40))
create_review("review-mobile.pdf", "mobile-390x844", (470, 940), (390, 844), (40, 40))
print("Created desktop and mobile review PDFs with 10 pages each.")
