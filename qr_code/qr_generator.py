# Main Source YT video: https://www.youtube.com/watch?v=pJdTyvufOdg&t=13s

import qrcode

url = input("URL eingeben: ").strip()
file_path = "qrcode_website.png"

qr = qrcode.QRCode()
qr.add_data(url)

img = qr.make_image()
img.save(file_path)

print("QR-Code von meiner Website unter den Namen {} generiert.".format(file_path))