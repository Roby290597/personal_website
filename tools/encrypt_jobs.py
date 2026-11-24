"""
Verschlüsselt die Jobliste für die Jobs-Seite.

    python tools/encrypt_jobs.py            # liest data/jobs.json, schreibt data/jobs.enc.json

data/jobs.json ist die lesbare Liste und steht in .gitignore, kommt also nie ins Repo.
Committet wird nur data/jobs.enc.json. Das Passwort wird beim Start abgefragt.

Benötigt: pip install cryptography
"""
import base64
import getpass
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "jobs.json"
DST = ROOT / "data" / "jobs.enc.json"
ITERATIONS = 600_000  # muss nicht mit jobs.js übereinstimmen, steht in der Datei


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def main() -> None:
    if not SRC.exists():
        sys.exit(f"{SRC} fehlt. Kopiere data/jobs.example.json nach data/jobs.json und trage deine Jobs ein.")

    data = json.loads(SRC.read_text(encoding="utf-8"))  # prüft nebenbei, ob die JSON gültig ist

    pw = getpass.getpass("Passwort: ")
    if pw != getpass.getpass("Passwort wiederholen: "):
        sys.exit("Passwörter stimmen nicht überein.")
    if len(pw) < 12:
        print("Hinweis: Ein längeres Passwort (12+ Zeichen) ist deutlich sicherer.")

    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(pw.encode())
    ct = AESGCM(key).encrypt(iv, json.dumps(data, ensure_ascii=False).encode(), None)  # ct enthält das GCM-Tag

    DST.write_text(json.dumps({"v": 1, "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}),
                   encoding="utf-8")
    n_app, n_plan = len(data.get("applied", [])), len(data.get("planned", []))
    print(f"{DST.relative_to(ROOT)} geschrieben ({n_app} beworben, {n_plan} geplant).")


if __name__ == "__main__":
    main()
