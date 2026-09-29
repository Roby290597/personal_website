/* Funktionstest der Lektions-Engine in einer simulierten Browser-Umgebung.
   Spielt eine komplette Lektion durch und prueft Stepper, Antwortpruefung,
   Fortschrittsspeicherung und Abschlussbildschirm. */

const { JSDOM } = require('/sessions/practical-quirky-pasteur/t/node_modules/jsdom');
const fs = require('fs');
const path = require('path');

const BASIS = '/sessions/practical-quirky-pasteur/mnt/academy/1_klasse';

let fehler = 0;
function pruefe(name, bedingung, zusatz) {
  const ok = !!bedingung;
  if (!ok) fehler++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${zusatz ? '  (' + zusatz + ')' : ''}`);
}

function seiteLaden(ordner) {
  const datei = path.join(BASIS, ordner, 'index.html');
  const dom = new JSDOM(fs.readFileSync(datei, 'utf8'), {
    runScripts: 'outside-only',
    url: 'https://example.test/academy/1_klasse/' + ordner + '/',
    beforeParse(win) {
      // Engine per Dateisystem einspielen (JSDOM laedt keine externen Skripte)
      win.__ladeSkript = (p) =>
        win.eval(fs.readFileSync(path.join(BASIS, '..', p), 'utf8'));
      win.fetch = () => Promise.reject(new Error('offline')); // Topbar ist optional
      win.scrollTo = () => {};
      win.confirm = () => true;
    },
  });

  const win = dom.window;
  win.eval(fs.readFileSync('/sessions/practical-quirky-pasteur/mnt/academy/assets/lesson-engine.js', 'utf8'));

  // Das Inline-Skript der Seite ausfuehren (LEKTIONEN + LessonEngine.start)
  const inline = [...win.document.querySelectorAll('script:not([src])')].pop();
  win.eval(inline.textContent);

  return win;
}

function lektionLoesen(win) {
  const doc = win.document;
  const karten = [...doc.querySelectorAll('[data-aufgabe]')];

  karten.forEach((karte) => {
    const mc = karte.querySelector('[data-rolle="mc"]');
    const input = karte.querySelector('[data-rolle="input"]');
    const idx = Number(karte.dataset.aufgabe);
    const aufgabe = win.LessonEngine._zustand().cfg.lektionen[
      win.LessonEngine._zustand().aktuelleLektion
    ].aufgaben[idx];

    if (mc) {
      mc.children[aufgabe.richtig].dispatchEvent(new win.Event('click'));
    } else if (input) {
      input.value = aufgabe.antwort;
      karte.querySelector('[data-rolle="pruefen"]').dispatchEvent(new win.Event('click'));
    }
  });

  return karten.length;
}

// ─── Test 1: Grundzustand ────────────────────────────────────────────────────

for (const ordner of ['zahlen-bis-20', 'formen-muster', 'plus-minus-bis-20']) {
  console.log(`\n── ${ordner} ──`);
  const win = seiteLaden(ordner);
  const doc = win.document;
  const z = win.LessonEngine._zustand();

  pruefe('Geruest gebaut', !!doc.querySelector('#ak-stepper'));
  pruefe('Stepper hat eine Schaltflaeche je Lektion',
    doc.querySelectorAll('#ak-stepper button').length === z.cfg.lektionen.length,
    `${doc.querySelectorAll('#ak-stepper button').length} Schaltflächen`);
  pruefe('Nur Lektion 1 ist freigeschaltet',
    doc.querySelectorAll('#ak-stepper button:disabled').length === z.cfg.lektionen.length - 1);
  pruefe('Titel gesetzt', doc.querySelector('h1').textContent.length > 0,
    doc.querySelector('h1').textContent);
  pruefe('Fortschrittsbalken bei 0%',
    doc.querySelector('[data-rolle="balken"]').style.width === '0%');
  pruefe('Abschluss-Schaltflaeche zunaechst gesperrt',
    doc.querySelector('[data-rolle="fertig"]').disabled);

  // Erste Lektion loesen
  const anzahl = lektionLoesen(win);
  pruefe(`Alle ${anzahl} Aufgaben als geloest markiert`,
    doc.querySelectorAll('[data-aufgabe].geloest').length === anzahl,
    `${doc.querySelectorAll('[data-aufgabe].geloest').length}/${anzahl}`);
  pruefe('Abschluss-Schaltflaeche jetzt frei',
    !doc.querySelector('[data-rolle="fertig"]').disabled);
  pruefe('Zaehler zeigt vollstaendig an',
    doc.querySelector('#ak-lektion span.text-slate-400').textContent === `Aufgaben (${anzahl}/${anzahl})`,
    doc.querySelector('#ak-lektion span.text-slate-400').textContent);

  // Falsche Antwort darf nicht durchgehen
  const winB = seiteLaden(ordner);
  const karteB = winB.document.querySelector('[data-aufgabe]');
  const mcB = karteB.querySelector('[data-rolle="mc"]');
  if (mcB) {
    const richtig = winB.LessonEngine._zustand().cfg.lektionen[0].aufgaben[0].richtig;
    const falsch = richtig === 0 ? 1 : 0;
    mcB.children[falsch].dispatchEvent(new winB.Event('click'));
    pruefe('Falsche Antwort loest nicht aus', !karteB.classList.contains('geloest'));
    pruefe('Fehler-Feedback erscheint',
      karteB.querySelector('[data-rolle="feedback"]').className.includes('feedback-err'));
  }

  // Kompletten Kurs durchspielen
  const gesamt = win.LessonEngine._zustand().cfg.lektionen.length;
  for (let i = 0; i < gesamt; i++) {
    doc.querySelector('[data-rolle="fertig"]').dispatchEvent(new win.Event('click'));
    if (i < gesamt - 1) lektionLoesen(win);
  }

  pruefe('Abschlussbildschirm sichtbar',
    !doc.querySelector('#ak-abschluss').classList.contains('hidden'));
  pruefe('Lektionsansicht ausgeblendet',
    doc.querySelector('#ak-lektion').classList.contains('hidden'));
  pruefe('Fortschrittsbalken bei 100%',
    doc.querySelector('[data-rolle="balken"]').style.width === '100%');
  pruefe('Stepper komplett abgehakt',
    [...doc.querySelectorAll('#ak-stepper button')].every((b) => b.textContent === '✓'));

  // Fortschritt gespeichert?
  const key = win.LessonEngine._zustand().cfg.progressKey;
  const gespeichert = JSON.parse(win.localStorage.getItem(key));
  pruefe('Fortschritt in localStorage abgelegt',
    gespeichert && gespeichert.completed.length === gesamt,
    `${key} → ${gespeichert ? gespeichert.completed.length : 0}/${gesamt}`);
}

console.log(`\n${fehler === 0 ? '✅ Alle Prüfungen bestanden.' : '❌ ' + fehler + ' Prüfung(en) fehlgeschlagen.'}`);
process.exit(fehler === 0 ? 0 : 1);
