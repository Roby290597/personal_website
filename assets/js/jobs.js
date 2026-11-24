// ──────────────────────────────────────────────────────────────────────────────
// Jobs-Seite: entschlüsselt data/jobs.enc.json im Browser.
//
// Die Jobliste liegt im (öffentlichen) Repo NUR verschlüsselt. Ohne Passwort
// ist sie nicht lesbar, auch nicht im Quellcode. Verschlüsselt wird lokal mit
// tools/encrypt_jobs.py (gleiches Verfahren wie hier):
//   Schlüssel = PBKDF2-SHA256(Passwort, salt, iterations) → 256 Bit
//   Daten     = AES-GCM(Schlüssel, iv)
// ──────────────────────────────────────────────────────────────────────────────

const JOBS_FILE = 'data/jobs.enc.json';
const SESSION_KEY = 'jobs_pw';   // Passwort nur für diesen Tab merken

function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function decryptJobs(password) {
  const res = await fetch(JOBS_FILE, { cache: 'no-store' });
  if (!res.ok) throw new Error('Datei nicht gefunden: ' + JOBS_FILE);
  const box = await res.json();

  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(box.salt), iterations: box.iter },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

  // Bei falschem Passwort wirft decrypt() einen Fehler (GCM-Tag passt nicht)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(box.iv) }, key, b64ToBytes(box.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

// Farbe des Status-Badges, abhängig vom Text in der JSON
function statusClass(status) {
  const s = (status || '').toLowerCase();
  if (/absage|rejected/.test(s)) return 'border-rose-500/40 text-rose-300';
  if (/zusage|angebot|offer/.test(s)) return 'border-emerald-400/60 text-emerald-300';
  if (/gespräch|interview|einladung|test/.test(s)) return 'border-amber-400/50 text-amber-300';
  return 'border-slate-700 text-slate-300';
}

// Kleiner Helfer: Element bauen. Text wird immer als textContent gesetzt,
// damit nichts aus der JSON als HTML ausgeführt wird.
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function jobCard(job, kind) {
  const card = el('article', 'rounded-3xl border border-slate-800 bg-slate-900/30 p-5');

  const head = el('div', 'flex items-start justify-between gap-3');
  const titles = el('div');
  titles.append(el('h3', 'font-semibold', job.title || '–'));
  titles.append(el('p', 'text-sm text-slate-400',
    [job.company, job.location].filter(Boolean).join(' · ')));
  head.append(titles);
  if (job.status) {
    head.append(el('span', 'shrink-0 rounded-full border px-3 py-1 text-xs ' + statusClass(job.status), job.status));
  }
  card.append(head);

  // beworben: Bewerbungsdatum, geplant: Frist
  const date = kind === 'applied' ? job.applied_on : job.deadline;
  if (date) {
    const label = kind === 'applied' ? 'Beworben am ' : 'Frist: ';
    card.append(el('p', 'mt-3 text-xs text-slate-400', label + date));
  }
  if (job.notes) card.append(el('p', 'mt-2 text-sm text-slate-300', job.notes));
  if (job.link) {
    const a = el('a', 'mt-3 inline-block text-sm text-emerald-300 hover:text-emerald-200', 'Ausschreibung →');
    a.href = job.link; a.target = '_blank'; a.rel = 'noreferrer';
    card.append(a);
  }
  return card;
}

function render(data) {
  for (const kind of ['applied', 'planned']) {
    const list = document.getElementById('list-' + kind);
    const jobs = data[kind] || [];
    list.replaceChildren(...jobs.map((j) => jobCard(j, kind)));
    if (!jobs.length) list.append(el('p', 'text-sm text-slate-500', '–'));
    document.getElementById('count-' + kind).textContent = '(' + jobs.length + ')';
  }
  document.getElementById('lock').hidden = true;
  document.getElementById('content').hidden = false;
}

async function unlock(password, silent) {
  const err = document.getElementById('lock-error');
  err.hidden = true;
  try {
    render(await decryptJobs(password));
    sessionStorage.setItem(SESSION_KEY, password);
  } catch (e) {
    sessionStorage.removeItem(SESSION_KEY);
    if (!silent) err.hidden = false;
    console.error(e);
  }
}

document.getElementById('lock-form').addEventListener('submit', (e) => {
  e.preventDefault();
  unlock(document.getElementById('pw').value, false);
});

document.getElementById('logout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
});

// Im selben Tab schon entsperrt? Dann direkt öffnen.
const remembered = sessionStorage.getItem(SESSION_KEY);
if (remembered) unlock(remembered, true);
