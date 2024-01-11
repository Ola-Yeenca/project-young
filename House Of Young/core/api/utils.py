import qrcode
from io import BytesIO
from django.core.files import File

def generate_qr_code(event):
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(f"Event: {event.title}\nDate: {event.event_date}\n")
    qr.make(fit=True)


    img = qr.make_image(fill_color="black", back_color="white")

    buffer = BytesIO()
    img.save(buffer)
    buffer.seek(0)


    event.qr_code.save(f"{event.title}_qr_code.png", File(buffer), save=True)

    return event.qr_code.url
