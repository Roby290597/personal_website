// Aktuelles Jahr im Footer
document.getElementById("y").textContent = new Date().getFullYear();

// Speicher für die geladenen Texte
let translations = {};

async function applyLang(lang) {
  try {
    // JSON-Datei laden
    const response = await fetch(`./lang-${lang}.json`);
    if (!response.ok) throw new Error("Sprachdatei konnte nicht geladen werden");
    
    translations = await response.json();

    // HTML Lang-Attribut setzen
    document.documentElement.lang = lang;

    // Alle Elemente mit [data-i18n] aktualisieren
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (translations[key]) {
        el.textContent = translations[key];
      }
    });

    // Button-Zustand (Styling)
    const deBtn = document.getElementById("btn-de");
    const enBtn = document.getElementById("btn-en");

    if (lang === "de") {
      deBtn.classList.add("bg-slate-800/60");
      enBtn.classList.remove("bg-slate-800/60");
    } else {
      enBtn.classList.add("bg-slate-800/60");
      deBtn.classList.remove("bg-slate-800/60");
    }

    // Auswahl speichern
    localStorage.setItem("lang", lang);
  } catch (error) {
    console.error("Fehler beim Sprachwechsel:", error);
  }
}

// Initialisierung
const savedLang = localStorage.getItem("lang") || "de";
applyLang(savedLang);


// --- Theme ---
function applyTheme(theme) {
  // For your CSS variables: [data-theme="light"]
  document.documentElement.setAttribute("data-theme", theme);

  // Optional: Tailwind dark variants
  document.documentElement.classList.toggle("dark", theme === "dark");

  localStorage.setItem("theme", theme);

  const btn = $("#themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}

function detectPreferredTheme() {   
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
}

// Event Listener
document.getElementById("btn-de").addEventListener("click", () => applyLang("de"));
document.getElementById("btn-en").addEventListener("click", () => applyLang("en"));

  // Theme init + button
  const savedTheme = localStorage.getItem("theme");
  applyTheme(savedTheme || detectPreferredTheme());

  $("#themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });