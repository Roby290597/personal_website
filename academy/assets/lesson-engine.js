/* ============================================================================
   lesson-engine.js — gemeinsame Lektions-Engine der Akademie
   ----------------------------------------------------------------------------
   Eine Lektionsseite enthaelt nur noch Inhalt + Konfiguration:

     <link rel="stylesheet" href="../../assets/lesson.css" />
     <main id="lesson-root"></main>
     <script src="../../assets/lesson-engine.js"></script>
     <script>
       LessonEngine.start({
         progressKey: 'k1_zahlen_progress',
         basis: '../../../',
         emoji: '🔢',
         titel: 'Zahlen bis 20',
         untertitel: '8 Lektionen · Klasse 1',
         badge: 'Klasse 1 · Zahlen',
         abschluss: { titel: '...', text: '...', statistik: [...] },
         lektionen: LEKTIONEN
       });
     </script>

   Aufgabentypen
   -------------
   mc      { typ:'mc',     frage, optionen:[...], richtig:Index, hinweis? }
   zahl    { typ:'zahl',   frage, antwort:Zahl, toleranz?, einheit?, hinweis? }
   text    { typ:'text',   frage, antwort:'x' | ['x','y'], hinweis? }
   widget  { typ:'widget', frage?, html, init(host, api), hinweis? }

   Der widget-Typ traegt beliebiges HTML/SVG mit eigener Logik. Die init-
   Funktion bekommt den Container und eine API:
       api.loesen(text?)   -> Aufgabe als geloest markieren
       api.fehler(text?)   -> Fehlermeldung zeigen
       api.istGeloest()    -> bool
   Damit ueberleben interaktive Visualisierungen (Einheitskreis, Pythagoras,
   Zahlenstrahl, Funktionsplotter) die Migration in die Engine.

   Theorie
   -------
   theorie      -> reiner Text, wird escaped, Zeilenumbrueche bleiben erhalten
   theorieHtml  -> rohes HTML/SVG, wird unveraendert eingesetzt
   ========================================================================== */

(function (global) {
  'use strict';

  // ─── Zustand ─────────────────────────────────────────────────────────────

  var cfg = null;          // aktive Konfiguration
  var lektionen = [];      // cfg.lektionen
  var fortschritt = null;  // { completed: [], current: 0 }
  var aktuelleLektion = 0;
  var geloest = {};        // { aufgabenIndex: true } fuer die aktuelle Lektion
  var wurzel = null;       // Container-Element

  // Referenzen auf erzeugte Elemente (statt CSS-Selektor-Suche)
  var el = {};

  // ─── Hilfsfunktionen ─────────────────────────────────────────────────────

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function machen(tag, klasse, html) {
    var n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function normalisieren(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function wackeln(node) {
    if (!node) return;
    node.classList.remove('ak-shake');
    void node.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
    node.classList.add('ak-shake');
    setTimeout(function () { node.classList.remove('ak-shake'); }, 400);
  }

  // ─── Fortschritt (localStorage) ──────────────────────────────────────────

  function fortschrittLaden() {
    try {
      var roh = localStorage.getItem(cfg.progressKey);
      var p = roh ? JSON.parse(roh) : null;
      if (!p || !Array.isArray(p.completed)) return { completed: [], current: 0 };
      return { completed: p.completed, current: p.current || 0 };
    } catch (e) {
      return { completed: [], current: 0 };
    }
  }

  function fortschrittSpeichern() {
    try {
      localStorage.setItem(cfg.progressKey, JSON.stringify(fortschritt));
    } catch (e) {
      /* Privater Modus o.ae. — Fortschritt geht dann nur nicht verloren-sicher */
    }
  }

  function istFrei(idx) {
    return idx === 0 || fortschritt.completed.indexOf(idx - 1) !== -1;
  }

  function zuruecksetzen() {
    if (!confirm('Möchtest du wirklich neu starten? 🤔')) return;
    try { localStorage.removeItem(cfg.progressKey); } catch (e) {}
    location.reload();
  }

  // ─── Grundgeruest der Seite ──────────────────────────────────────────────

  function geruestBauen() {
    var akademie = cfg.akademieLink || (cfg.basis + 'academy.html');

    wurzel.innerHTML =
      '<div class="flex items-center justify-between mb-6">' +
        '<a href="' + esc(akademie) + '" class="text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium">← Zurück zur Akademie</a>' +
        (cfg.badge ? '<span class="badge">' + esc(cfg.badge) + '</span>' : '') +
      '</div>' +

      '<div class="mb-8 text-center">' +
        (cfg.emoji ? '<div class="text-5xl mb-3">' + cfg.emoji + '</div>' : '') +
        '<h1 class="text-3xl font-black text-white mb-2">' + esc(cfg.titel) + '</h1>' +
        (cfg.untertitel ? '<p class="text-slate-400 text-base">' + esc(cfg.untertitel) + '</p>' : '') +
      '</div>' +

      (cfg.fortschrittsbalken === false ? '' :
        '<div class="mb-6">' +
          '<div class="flex justify-between text-sm text-slate-400 mb-2">' +
            '<span data-rolle="balken-text"></span>' +
            '<span data-rolle="balken-prozent"></span>' +
          '</div>' +
          '<div class="h-2 bg-slate-800 rounded-full overflow-hidden">' +
            '<div data-rolle="balken" class="h-2 bg-emerald-400 rounded-full transition-all duration-500" style="width:0%"></div>' +
          '</div>' +
        '</div>') +

      '<div id="ak-stepper" class="mb-8 flex flex-wrap gap-2 justify-center"></div>' +
      '<div id="ak-lektion"></div>' +
      '<div id="ak-abschluss" class="hidden text-center"></div>' +
      '<div id="ak-reset" class="text-center mt-10">' +
        '<button type="button" class="text-slate-600 hover:text-slate-400 text-sm transition-colors">Neu starten</button>' +
      '</div>';

    el.stepper       = wurzel.querySelector('#ak-stepper');
    el.lektion       = wurzel.querySelector('#ak-lektion');
    el.abschluss     = wurzel.querySelector('#ak-abschluss');
    el.reset         = wurzel.querySelector('#ak-reset');
    el.balken        = wurzel.querySelector('[data-rolle="balken"]');
    el.balkenText    = wurzel.querySelector('[data-rolle="balken-text"]');
    el.balkenProzent = wurzel.querySelector('[data-rolle="balken-prozent"]');

    el.reset.querySelector('button').addEventListener('click', zuruecksetzen);
  }

  // ─── Fortschrittsbalken ──────────────────────────────────────────────────

  function balkenAktualisieren() {
    if (!el.balken) return;

    var fertig = fortschritt.completed.length;
    var gesamt = lektionen.length;
    var prozent = gesamt ? Math.round((fertig / gesamt) * 100) : 0;

    el.balken.style.width = prozent + '%';
    el.balkenProzent.textContent = prozent + '%';
    el.balkenText.textContent = fertig + ' von ' + gesamt +
      (gesamt === 1 ? ' Lektion' : ' Lektionen') + ' abgeschlossen';
  }

  // ─── Stepper ─────────────────────────────────────────────────────────────

  function stepperZeichnen() {
    balkenAktualisieren();
    el.stepper.innerHTML = '';

    lektionen.forEach(function (l, idx) {
      var fertig = fortschritt.completed.indexOf(idx) !== -1;
      var frei   = istFrei(idx);
      var hier   = idx === aktuelleLektion;

      var btn = machen('button', 'step-btn');
      btn.type = 'button';
      btn.textContent = fertig ? '✓' : String(idx + 1);
      btn.title = l.titel || ('Lektion ' + (idx + 1));

      if (fertig)          btn.classList.add('step-complete');
      else if (hier)       btn.classList.add('step-current');
      else if (frei)       btn.classList.add('step-next');
      else               { btn.classList.add('step-locked'); btn.disabled = true; }

      if (frei) {
        btn.addEventListener('click', function () { zurLektion(idx); });
      }

      el.stepper.appendChild(btn);
    });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function zurLektion(idx) {
    if (!istFrei(idx)) return;

    aktuelleLektion = idx;
    geloest = {};
    fortschritt.current = idx;
    fortschrittSpeichern();

    el.abschluss.classList.add('hidden');
    el.lektion.classList.remove('hidden');
    el.reset.classList.remove('hidden');

    stepperZeichnen();
    lektionZeichnen();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Lektion rendern ─────────────────────────────────────────────────────

  function lektionZeichnen() {
    var l = lektionen[aktuelleLektion];
    var aufgaben = l.aufgaben || [];

    el.lektion.innerHTML = '';

    // Theorie-Karte
    var karte = machen('div', 'card mb-6');
    karte.innerHTML =
      '<div class="flex items-center gap-3 mb-1">' +
        '<span class="text-emerald-400 text-sm font-semibold">Lektion ' +
        (aktuelleLektion + 1) + ' von ' + lektionen.length + '</span>' +
      '</div>' +
      '<h2 class="text-2xl font-black text-white mb-5">' + esc(l.titel) + '</h2>';

    if (l.theorieHtml) {
      karte.appendChild(machen('div', 'theorie-html text-slate-200', l.theorieHtml));
    } else if (l.theorie) {
      karte.appendChild(machen('div', 'theorie-text text-slate-200', esc(l.theorie)));
    }

    el.lektion.appendChild(karte);

    // Aufgabenblock
    var block = machen('div', 'mb-6');
    var kopf = machen('div', 'flex items-center justify-between mb-3');
    el.zaehler = machen('span', 'text-slate-400 text-sm font-semibold');
    el.alleOk  = machen('span', 'text-slate-500 text-sm');
    kopf.appendChild(el.zaehler);
    kopf.appendChild(el.alleOk);
    block.appendChild(kopf);

    el.karten = [];
    aufgaben.forEach(function (a, idx) {
      var k = aufgabeBauen(a, idx);
      el.karten.push(k);
      block.appendChild(k);
    });

    el.lektion.appendChild(block);

    // Abschluss-Button
    var letzte = aktuelleLektion === lektionen.length - 1;
    var fuss = machen('div', 'text-center mt-4 mb-2');
    el.fertigBtn = machen('button', 'btn-primary text-xl px-10 py-5');
    el.fertigBtn.type = 'button';
    el.fertigBtn.dataset.rolle = 'fertig';
    el.fertigBtn.textContent = letzte ? 'Kurs abschließen 🏆' : 'Lektion abschließen ✅';
    el.fertigBtn.disabled = true;
    el.fertigBtn.addEventListener('click', lektionAbschliessen);
    el.hinweisFuss = machen('p', 'text-slate-500 text-sm mt-3', 'Löse alle Aufgaben! 💪');
    fuss.appendChild(el.fertigBtn);
    fuss.appendChild(el.hinweisFuss);
    el.lektion.appendChild(fuss);

    // Widgets erst initialisieren, wenn sie im DOM haengen
    aufgaben.forEach(function (a, idx) {
      if (a.typ === 'widget' && typeof a.init === 'function') {
        var host = el.karten[idx].querySelector('.widget-host');
        try {
          a.init(host, widgetApi(idx));
        } catch (e) {
          console.error('Widget in Aufgabe ' + idx + ' fehlgeschlagen:', e);
        }
      }
    });

    zaehlerAktualisieren();
  }

  // ─── Einzelne Aufgabe ────────────────────────────────────────────────────

  function aufgabeBauen(a, idx) {
    var karte = machen('div', 'card mb-4');
    karte.dataset.aufgabe = String(idx);

    if (a.frage || a.frageHtml) {
      var kopf = machen('div', 'flex items-start gap-3 mb-4');
      var icon = machen('span', 'text-2xl', '❓');
      icon.dataset.rolle = 'icon';
      var text = machen('p', 'text-lg font-semibold text-white leading-snug',
        a.frageHtml || esc(a.frage));
      kopf.appendChild(icon);
      kopf.appendChild(text);
      karte.appendChild(kopf);
    }

    if (a.typ === 'mc')          karte.appendChild(mcBauen(a, idx));
    else if (a.typ === 'zahl')   karte.appendChild(eingabeBauen(a, idx, 'zahl'));
    else if (a.typ === 'text')   karte.appendChild(eingabeBauen(a, idx, 'text'));
    else if (a.typ === 'widget') karte.appendChild(widgetBauen(a, idx));

    var fb = machen('div', 'mt-3 hidden');
    fb.dataset.rolle = 'feedback';
    karte.appendChild(fb);

    return karte;
  }

  function mcBauen(a, idx) {
    var grid = machen('div', 'grid grid-cols-2 gap-3');
    grid.dataset.rolle = 'mc';

    a.optionen.forEach(function (opt, oi) {
      var b = machen('button', 'btn-option');
      b.type = 'button';
      b.innerHTML = esc(opt);
      b.addEventListener('click', function () { mcPruefen(idx, oi); });
      grid.appendChild(b);
    });

    return grid;
  }

  function eingabeBauen(a, idx, art) {
    var box = machen('div', 'flex flex-col items-center gap-3');

    var input = document.createElement('input');
    input.dataset.rolle = 'input';
    if (art === 'zahl') {
      // Bewusst kein type="number": das verwirft die deutsche Komma-Schreibweise
      // ("1,42" waere dort ein leerer Wert). inputmode sorgt auf dem Handy
      // trotzdem fuer die Zahlentastatur.
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.className = 'number-input';
      input.placeholder = '?';
    } else {
      input.type = 'text';
      input.className = 'text-input';
      input.placeholder = '…';
    }

    var pruefen = function () {
      if (art === 'zahl') zahlPruefen(idx); else textPruefen(idx);
    };

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); pruefen(); }
    });

    box.appendChild(input);

    if (a.einheit) {
      box.appendChild(machen('span', 'text-slate-400 text-sm', esc(a.einheit)));
    }

    var btn = machen('button', 'btn-primary px-8 py-3', 'Prüfen');
    btn.type = 'button';
    btn.dataset.rolle = 'pruefen';
    btn.addEventListener('click', pruefen);
    box.appendChild(btn);

    return box;
  }

  function widgetBauen(a, idx) {
    var host = machen('div', 'widget-host', a.html || '');
    return host;
  }

  // ─── Antworten pruefen ───────────────────────────────────────────────────

  function karteVon(idx) { return el.karten[idx]; }

  function feedbackSetzen(idx, ok, text) {
    var fb = karteVon(idx).querySelector('[data-rolle="feedback"]');
    if (!fb) return;
    fb.className = (ok ? 'feedback-ok' : 'feedback-err') + ' mt-3';
    fb.textContent = text;
    fb.classList.remove('hidden');
  }

  function mcPruefen(idx, gewaehlt) {
    var a = lektionen[aktuelleLektion].aufgaben[idx];
    if (geloest[idx]) return;

    var grid = karteVon(idx).querySelector('[data-rolle="mc"]');
    var buttons = Array.prototype.slice.call(grid.children);

    if (gewaehlt === a.richtig) {
      buttons.forEach(function (b, i) {
        b.disabled = true;
        b.classList.add(i === a.richtig ? 'correct' : 'wrong');
      });
      feedbackSetzen(idx, true, a.lob || 'Super! 🌟 Das ist richtig!');
      alsGeloest(idx);
    } else {
      var b = buttons[gewaehlt];
      b.classList.add('wrong');
      wackeln(b);
      setTimeout(function () { b.classList.remove('wrong'); }, 700);
      feedbackSetzen(idx, false, a.hinweis || 'Nicht ganz — schau nochmal hin! 🤔');
    }
  }

  function zahlPruefen(idx) {
    var a = lektionen[aktuelleLektion].aufgaben[idx];
    if (geloest[idx]) return;

    var input = karteVon(idx).querySelector('[data-rolle="input"]');
    var wert = parseFloat(String(input.value).replace(',', '.'));
    var toleranz = a.toleranz != null ? a.toleranz : 0;

    if (!isNaN(wert) && Math.abs(wert - a.antwort) <= toleranz) {
      eingabeSperren(idx, input, a.antwort);
      feedbackSetzen(idx, true, a.lob || 'Toll gemacht! 🎉 Das ist richtig!');
      alsGeloest(idx);
    } else {
      input.classList.add('falsch');
      wackeln(input);
      setTimeout(function () { input.classList.remove('falsch'); }, 700);
      feedbackSetzen(idx, false, a.hinweis || 'Nicht ganz! 💪 Versuch es nochmal.');
    }
  }

  function textPruefen(idx) {
    var a = lektionen[aktuelleLektion].aufgaben[idx];
    if (geloest[idx]) return;

    var input = karteVon(idx).querySelector('[data-rolle="input"]');
    var gegeben = normalisieren(input.value);
    var erlaubt = Array.isArray(a.antwort) ? a.antwort : [a.antwort];
    var passt = erlaubt.some(function (x) { return normalisieren(x) === gegeben; });

    if (gegeben && passt) {
      eingabeSperren(idx, input, input.value);
      feedbackSetzen(idx, true, a.lob || 'Richtig! 🎉');
      alsGeloest(idx);
    } else {
      input.classList.add('falsch');
      wackeln(input);
      setTimeout(function () { input.classList.remove('falsch'); }, 700);
      feedbackSetzen(idx, false, a.hinweis || 'Noch nicht ganz. Versuch es nochmal! 💪');
    }
  }

  function eingabeSperren(idx, input, wert) {
    input.value = wert;
    input.disabled = true;
    input.classList.remove('falsch');
    input.classList.add('richtig');
    var btn = karteVon(idx).querySelector('[data-rolle="pruefen"]');
    if (btn) btn.remove();
  }

  // API, die eine Widget-Aufgabe bekommt
  function widgetApi(idx) {
    return {
      loesen: function (text) {
        if (geloest[idx]) return;
        feedbackSetzen(idx, true, text || 'Richtig! 🎉');
        alsGeloest(idx);
      },
      fehler: function (text) {
        feedbackSetzen(idx, false, text || 'Noch nicht ganz — probier es nochmal! 💪');
      },
      istGeloest: function () { return !!geloest[idx]; }
    };
  }

  // ─── Fortschritt innerhalb der Lektion ───────────────────────────────────

  function alsGeloest(idx) {
    geloest[idx] = true;

    var karte = karteVon(idx);
    karte.classList.add('geloest');

    var icon = karte.querySelector('[data-rolle="icon"]');
    if (icon) icon.textContent = '✅';

    zaehlerAktualisieren();
  }

  function zaehlerAktualisieren() {
    var gesamt = (lektionen[aktuelleLektion].aufgaben || []).length;
    var anzahl = Object.keys(geloest).length;
    var alle = anzahl === gesamt;

    if (el.zaehler) el.zaehler.textContent = 'Aufgaben (' + anzahl + '/' + gesamt + ')';
    if (el.alleOk)  el.alleOk.textContent = alle ? '✅ Alle gelöst!' : '';

    if (el.fertigBtn) el.fertigBtn.disabled = !alle;
    if (el.hinweisFuss) el.hinweisFuss.classList.toggle('hidden', alle);
  }

  // ─── Lektion abschliessen ────────────────────────────────────────────────

  function lektionAbschliessen() {
    var idx = aktuelleLektion;

    if (fortschritt.completed.indexOf(idx) === -1) {
      fortschritt.completed.push(idx);
    }

    if (idx === lektionen.length - 1) {
      fortschrittSpeichern();
      abschlussZeigen();
    } else {
      fortschritt.current = idx + 1;
      fortschrittSpeichern();
      zurLektion(idx + 1);
    }
  }

  // ─── Abschlussbildschirm ─────────────────────────────────────────────────

  function abschlussZeigen() {
    var a = cfg.abschluss || {};

    var statistik = (a.statistik || []).slice();
    // Zwei Standardkacheln voranstellen, wenn nicht ausdruecklich abgeschaltet
    if (a.standardStatistik !== false) {
      statistik.unshift(
        { wert: lektionen.length, label: 'Lektionen' },
        { wert: lektionen.reduce(function (s, l) { return s + (l.aufgaben || []).length; }, 0), label: 'Aufgaben' }
      );
    }

    var kacheln = statistik.map(function (s) {
      return '<div class="card text-center">' +
        '<div class="text-3xl font-black text-emerald-400">' + esc(s.wert) + '</div>' +
        '<div class="text-slate-400 text-sm mt-1">' + esc(s.label) + '</div>' +
      '</div>';
    }).join('');

    var akademie = cfg.akademieLink || (cfg.basis + 'academy.html');

    el.abschluss.innerHTML =
      '<div class="card p-10 mb-6">' +
        '<div class="text-7xl mb-5">' + (a.emoji || '🏆') + '</div>' +
        '<h2 class="text-3xl font-black text-white mb-4">' + esc(a.titel || 'Geschafft!') + '</h2>' +
        '<p class="text-xl text-slate-300 mb-6">' + esc(a.text || 'Super gemacht! 🎉') + '</p>' +
        '<div class="grid grid-cols-2 gap-4 mb-8">' + kacheln + '</div>' +
        (a.extraHtml || '') +
        '<a href="' + esc(akademie) + '" class="btn-primary inline-block text-center no-underline">Zur Akademie 🚀</a>' +
      '</div>' +
      '<button type="button" data-rolle="reset" class="text-slate-500 hover:text-slate-300 text-sm mt-2 transition-colors">Neu starten</button>';

    el.abschluss.querySelector('[data-rolle="reset"]').addEventListener('click', zuruecksetzen);

    el.lektion.classList.add('hidden');
    el.reset.classList.add('hidden');
    el.abschluss.classList.remove('hidden');

    stepperZeichnen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Topbar ──────────────────────────────────────────────────────────────

  function topbarLaden() {
    var host = document.getElementById('topbar-container');
    if (!host) return;

    global.__i18nBase = cfg.basis;

    fetch(cfg.basis + 'topbar.html')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) { if (html) host.innerHTML = html; })
      .catch(function () { /* Topbar ist optional */ });
  }

  // ─── Start ───────────────────────────────────────────────────────────────

  function start(konfiguration) {
    cfg = konfiguration || {};
    cfg.basis = cfg.basis || '../../../';
    lektionen = cfg.lektionen || [];

    if (!cfg.progressKey) {
      console.error('LessonEngine: progressKey fehlt — Fortschritt wird nicht gespeichert.');
      cfg.progressKey = 'ak_temp_' + location.pathname;
    }

    wurzel = document.getElementById(cfg.wurzelId || 'lesson-root');
    if (!wurzel) {
      console.error('LessonEngine: Container #lesson-root nicht gefunden.');
      return;
    }

    if (!lektionen.length) {
      wurzel.innerHTML = '<p class="text-slate-400 text-center py-20">Diese Lektion hat noch keine Inhalte.</p>';
      return;
    }

    fortschritt = fortschrittLaden();

    geruestBauen();
    topbarLaden();

    // Alles fertig? Dann direkt den Abschluss zeigen.
    if (fortschritt.completed.length >= lektionen.length) {
      aktuelleLektion = lektionen.length - 1;
      stepperZeichnen();
      abschlussZeigen();
      return;
    }

    // Auf die letzte freigeschaltete Lektion zurueckfallen
    aktuelleLektion = fortschritt.current || 0;
    if (aktuelleLektion >= lektionen.length) aktuelleLektion = lektionen.length - 1;
    while (aktuelleLektion > 0 && !istFrei(aktuelleLektion)) aktuelleLektion--;

    fortschritt.current = aktuelleLektion;
    fortschrittSpeichern();

    stepperZeichnen();
    lektionZeichnen();
  }

  // ─── Oeffentliche API ────────────────────────────────────────────────────

  global.LessonEngine = {
    start: start,
    zuruecksetzen: zuruecksetzen,
    zurLektion: zurLektion,
    // Nur fuer Debugging in der Konsole
    _zustand: function () {
      return { cfg: cfg, fortschritt: fortschritt, aktuelleLektion: aktuelleLektion, geloest: geloest };
    }
  };

})(window);
