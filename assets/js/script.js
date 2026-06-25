// Aktuelles Jahr im Footer setzen
document.getElementById("y").textContent = new Date().getFullYear();

let translations = {};

// ──────────────────────────────────────────────────────────────────────────────
// _currentPage()
// Liest den Dateinamen der aktuellen Seite aus der URL aus.
// Beispiel: "klasse-1/zahlen-bis-20.html" → "zahlen-bis-20"
//           "index.html"                  → "index"
//           "/"                           → "index" (Stammverzeichnis)
// Wird gebraucht, um die richtige seitenspezifische JSON zu laden.
// ──────────────────────────────────────────────────────────────────────────────
function _currentPage() {
  const name = location.pathname.split('/').pop().replace(/\.html$/, '');
  return name || 'index';
}

// ──────────────────────────────────────────────────────────────────────────────
// applyLang(lang)
// Lädt die Übersetzungen für die gewählte Sprache und wendet sie auf alle
// Elemente mit data-i18n-Attribut an.
//
// Ladereihenfolge (mit automatischem Fallback):
//   1. Neue Struktur: i18n/{lang}/global.json + i18n/{lang}/{page}.json
//   2. Fallback:      lang-{lang}.json  (für ältere Serverversionen)
//
// window.__i18nBase kann von Unterseiten gesetzt werden, damit die Pfade
// korrekt zur Projektroot zeigen, z.B.:
//   window.__i18nBase = '../';  // in klasse-1/*.html
// ──────────────────────────────────────────────────────────────────────────────
async function applyLang(lang) {
  try {
    // __i18nBase: Unterordner-Seiten (z.B. klasse-1/) setzen diesen Wert auf '../',
    // damit die i18n-Dateien relativ zur Projektroot und nicht zum Unterordner gesucht werden.
    const base = window.__i18nBase || './';
    const page = _currentPage();

    let data = {};

    // ── Versuch 1: Neue i18n/-Ordnerstruktur ──────────────────────────────────
    // .catch(() => null) verhindert einen Absturz, falls die Datei nicht existiert.
    const globalRes = await fetch(`${base}i18n/${lang}/global.json`).catch(() => null);

    if (globalRes && globalRes.ok) {
      // global.json gefunden → enthält Nav-Links und seitenübergreifende Texte
      data = await globalRes.json();

      // Zusätzlich seitenspezifische JSON laden (z.B. index.json, academy.json)
      // Fehler werden ignoriert – nicht jede Seite braucht eine eigene Datei.
      const pageRes = await fetch(`${base}i18n/${lang}/${page}.json`).catch(() => null);
      if (pageRes && pageRes.ok) {
        // Object.assign() fügt alle Schlüssel aus pageRes in data ein (überschreibt bei Duplikaten)
        Object.assign(data, await pageRes.json());
      }
    } else {
      // ── Versuch 2: Alter Fallback mit lang-de.json / lang-en.json ──────────
      // Wird verwendet, wenn die i18n/-Ordnerstruktur noch nicht auf dem Server liegt.
      const fallbackRes = await fetch(`${base}lang-${lang}.json`);
      if (!fallbackRes.ok) throw new Error('Keine Sprachdatei gefunden');
      data = await fallbackRes.json();
    }

    translations = data;
    document.documentElement.lang = lang;

    // Alle Elemente mit data-i18n-Attribut mit dem übersetzten Text befüllen
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (translations[key]) el.textContent = translations[key];
    });

    // Aktiven Sprach-Button optisch hervorheben
    const deBtn = document.getElementById("btn-de");
    const enBtn = document.getElementById("btn-en");
    if (lang === "de") {
      deBtn.classList.add("bg-slate-800/60");
      enBtn.classList.remove("bg-slate-800/60");
    } else {
      enBtn.classList.add("bg-slate-800/60");
      deBtn.classList.remove("bg-slate-800/60");
    }

    localStorage.setItem("lang", lang);
  } catch (error) {
    console.error("Fehler beim Sprachwechsel:", error);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// applyTheme(theme)
// Schaltet zwischen Hell- und Dunkelmodus um.
// Setzt das data-theme-Attribut auf <html>, das in style.css für CSS-Variablen
// (Farben, Hintergründe) ausgewertet wird.
// ──────────────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}

// Erkennt die vom Betriebssystem bevorzugte Farbe (Hell/Dunkel)
function detectPreferredTheme() {
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

// Flipbox-Touch-Support (nur auf Seiten mit .flipbox-Element)
const flipbox = document.querySelector(".flipbox");
if (flipbox) {
  flipbox.ontouchstart = () => flipbox.classList.toggle('hover');
}

// ── Event Listener ──────────────────────────────────────────────────────────
// Dieses Skript wird erst nach dem Topbar-Fetch geladen, daher sind alle
// Buttons hier garantiert im DOM vorhanden.
document.getElementById("btn-de").addEventListener("click", () => applyLang("de"));
document.getElementById("btn-en").addEventListener("click", () => applyLang("en"));

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});

// ── Initialisierung ─────────────────────────────────────────────────────────
const savedLang = localStorage.getItem("lang") || "de";
applyLang(savedLang);

applyTheme(localStorage.getItem("theme") || detectPreferredTheme());
