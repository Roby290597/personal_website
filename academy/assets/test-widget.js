// Prueft die beiden neuen Aufgabentypen: text und widget
const { JSDOM } = require('/sessions/practical-quirky-pasteur/t/node_modules/jsdom');
const fs = require('fs');

const dom = new JSDOM('<body><div id="topbar-container"></div><main id="lesson-root"></main></body>', {
  runScripts: 'outside-only', url: 'https://example.test/a/b/c/',
  beforeParse(w){ w.fetch=()=>Promise.reject(); w.scrollTo=()=>{}; w.confirm=()=>true; }
});
const win = dom.window, doc = win.document;
win.eval(fs.readFileSync('/sessions/practical-quirky-pasteur/mnt/academy/assets/lesson-engine.js','utf8'));

win.eval(`
LessonEngine.start({
  progressKey:'test_widget', basis:'../../../', titel:'Widget-Test',
  lektionen:[{
    titel:'Test', theorieHtml:'<p>Theorie mit <strong>HTML</strong> und SVG:</p><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    aufgaben:[
      {typ:'text', frage:'Wie heißt die Formel?', antwort:['a² + b² = c²','pythagoras']},
      {typ:'zahl', frage:'Wurzel aus 2?', antwort:1.414, toleranz:0.01},
      {typ:'widget', frage:'Klick den Kreis an', html:'<svg viewBox="0 0 100 40"><circle id="ziel" cx="50" cy="20" r="15" fill="#34d399"/></svg>',
        init:(host,api)=>{ host.querySelector('#ziel').addEventListener('click',()=>api.loesen('Getroffen! 🎯')); }}
    ]
  }]
});
`);

let f=0; const p=(n,c,z)=>{ if(!c) f++; console.log(`  ${c?'✓':'✗'} ${n}${z?'  ('+z+')':''}`); };

p('Theorie als HTML gerendert (nicht escaped)', !!doc.querySelector('.theorie-html strong'));
p('SVG in der Theorie erhalten', !!doc.querySelector('.theorie-html svg circle'));

const [t,zl,wg] = [...doc.querySelectorAll('[data-aufgabe]')];

// text: Alternativantwort + Gross-/Kleinschreibung
const ti = t.querySelector('[data-rolle="input"]');
ti.value = '  PYTHAGORAS ';
t.querySelector('[data-rolle="pruefen"]').dispatchEvent(new win.Event('click'));
p('text akzeptiert Alternativantwort, unabhängig von Schreibweise', t.classList.contains('geloest'));

// zahl mit Toleranz
const zi = zl.querySelector('[data-rolle="input"]');
zi.value = '1,42';                 // Komma als Dezimaltrennzeichen, innerhalb der Toleranz
zl.querySelector('[data-rolle="pruefen"]').dispatchEvent(new win.Event('click'));
p('zahl akzeptiert Komma und Toleranz', zl.classList.contains('geloest'));

// widget
p('Widget-HTML eingesetzt', !!wg.querySelector('.widget-host svg #ziel'));
p('Abschluss noch gesperrt', doc.querySelector('[data-rolle="fertig"]').disabled);
wg.querySelector('#ziel').dispatchEvent(new win.Event('click'));
p('Widget meldet Lösung an die Engine', wg.classList.contains('geloest'));
p('Eigene Rückmeldung übernommen', wg.querySelector('[data-rolle="feedback"]').textContent==='Getroffen! 🎯',
  wg.querySelector('[data-rolle="feedback"]').textContent);
p('Abschluss jetzt frei', !doc.querySelector('[data-rolle="fertig"]').disabled);

console.log(f?`\n❌ ${f} fehlgeschlagen`:'\n✅ Alle Prüfungen bestanden.');
process.exit(f?1:0);
