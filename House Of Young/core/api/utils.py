import qrcode
from io import BytesIO
from PIL import Image, ImageDraw
from django.core.files import File
from django.utils.text import slugify

def generate_qr_code(title, date):
    data = f"{title} - {date}"
    try:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill='black', back_color='white')
        buffer = BytesIO()
        img.save(buffer)
        buffer.seek(0)

        return File(buffer)
    except Exception as e:
        print(f"Error generating QR code: {e}")
        return None
