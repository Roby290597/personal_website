// Aktuelles Jahr im Footer
document.getElementById("y").textContent = new Date().getFullYear();

let translations = {};

async function applyLang(lang) {
  try {
    const response = await fetch(`./lang-${lang}.json`);
    if (!response.ok) throw new Error("Sprachdatei konnte nicht geladen werden");

    translations = await response.json();
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (translations[key]) el.textContent = translations[key];
    });

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

// Theme
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}

function detectPreferredTheme() {
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

// Flipbox (nur wenn vorhanden)
const flipbox = document.querySelector(".flipbox");
if (flipbox) {
  flipbox.ontouchstart = () => flipbox.classList.toggle('hover');
}

// Event Listener – Buttons sind jetzt garantiert im DOM (script wird nach topbar-fetch geladen)
document.getElementById("btn-de").addEventListener("click", () => applyLang("de"));
document.getElementById("btn-en").addEventListener("click", () => applyLang("en"));

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});

// Initialisierung (nach Event-Listenern, damit applyTheme den Button sofort updaten kann)
const savedLang = localStorage.getItem("lang") || "de";
applyLang(savedLang);

applyTheme(localStorage.getItem("theme") || detectPreferredTheme());
