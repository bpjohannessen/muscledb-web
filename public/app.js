'use strict';

/* muscledb single-page app (vanilla JS, no dependencies).
 * Hash routing (#/, #/group/:id, #/muscle/:id, #/artery|vein|nerve/:id, #/about).
 * API responses are cached in memory, so revisiting a page is instant.
 */

(function () {
  const view = document.getElementById('view');
  const navEl = document.querySelector('nav');

  /* -------------------------------- utils ------------------------------- */
  const cache = new Map();
  async function api(path) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch('api/' + path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    cache.set(path, json);
    return json;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isMissing(v) {
    if (v == null) return true;
    const s = String(v).trim();
    return s === '' || s.toUpperCase() === 'UNDEFINED';
  }
  function setView(html) {
    view.innerHTML = html;
    // restart the fade animation on each navigation
    view.style.animation = 'none';
    void view.offsetWidth;
    view.style.animation = '';
  }
  function loading() { setView('<p class="muted" style="text-align:center;padding:24px;">Loading…</p>'); }

  const IMG_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTAiIGhlaWdodD0iMTgwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjJmMmYyIiBzdHJva2U9IiNjY2NjY2MiLz48dGV4dCB4PSIxMjUiIHk9Ijk1IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+aW1hZ2Ugbm90IGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';

  function backLink() {
    return '<a href="#" class="back-link" onclick="history.back();return false;">Back</a>';
  }

  /* ------------------------------ search view --------------------------- */
  let searchTimer = null;
  async function renderSearch() {
    setView(
      '<input type="text" id="searchterm" placeholder="Search muscles…" autocomplete="off">' +
      '<table id="muscleResults"><tbody id="tbodyappend"></tbody></table>'
    );
    const input = document.getElementById('searchterm');
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(input.value.trim()), 120);
    });
    input.focus();
    runSearch('');
  }
  async function runSearch(term) {
    const rows = await api('muscles' + (term ? '?searchterm=' + encodeURIComponent(term) : ''));
    const body = document.getElementById('tbodyappend');
    if (!body) return;
    body.innerHTML = rows.map((m) =>
      '<tr><td id="muscleResultItem"><a href="#/muscle/' + m.id + '">' + esc(m.name) + '</a></td></tr>'
    ).join('') || '<tr><td id="muscleResultItem" class="muted">No matches</td></tr>';
  }

  /* --------------------------- muscle detail view ----------------------- */
  function vesselCell(items, kind) {
    const valid = (items || []).filter((it) => !isMissing(it.latinName));
    if (valid.length === 0) return '<span class="m-none">\u2014</span>';
    return valid.map((it) => '<a href="#/' + kind + '/' + it.id + '">' + esc(it.latinName) + '</a>').join('<br>');
  }
  function vesselLabel(items, singular, plural) {
    const n = (items || []).filter((it) => !isMissing(it.latinName)).length;
    return n > 1 ? plural : singular;
  }
  async function renderMuscle(id) {
    loading();
    let m;
    try { m = await api('muscles/' + id); } catch { return setView(backLink() + '<p class="muted">Muscle not found.</p>'); }

    let rows = '';
    rows += '<tr class="m-latin"><th colspan="2">' + esc(m.latinName) + '</th></tr>';
    rows += '<tr class="m-english"><th colspan="2">' + esc(m.name) + '</th></tr>';
    rows += '<tr class="m-groups"><td colspan="2">' +
      (m.muscleGroups || []).map((g) => esc(g.name)).join('<br>') + '</td></tr>';
    rows += '<tr><th>Origo:</th><td>' + esc(m.origo) + '</td></tr>';
    rows += '<tr><th>Insertio:</th><td>' + esc(m.insertio) + '</td></tr>';
    rows += '<tr><th>Functio:</th><td>' + esc(m.functio) + '</td></tr>';
    rows += '<tr class="m-vessel m-artery"><th>' + vesselLabel(m.muscleArteries, 'Artery:', 'Arteries:') +
      '</th><td>' + vesselCell(m.muscleArteries, 'artery') + '</td></tr>';
    rows += '<tr class="m-vessel m-vein"><th>' + vesselLabel(m.muscleVeins, 'Vein:', 'Veins:') +
      '</th><td>' + vesselCell(m.muscleVeins, 'vein') + '</td></tr>';
    rows += '<tr class="m-vessel m-nerve"><th>' + vesselLabel(m.muscleNerves, 'Nerve:', 'Nerves:') +
      '</th><td>' + vesselCell(m.muscleNerves, 'nerve') + '</td></tr>';
    if (m.image && String(m.image).trim() !== '') {
      rows += '<tr class="m-image"><td colspan="2"><img alt="' + esc(m.name) +
        '" src="images/muscles/' + esc(m.image) +
        '" onerror="this.onerror=null;this.src=\'' + IMG_PLACEHOLDER + '\';this.classList.add(\'m-img-missing\');"></td></tr>';
    }
    if (m.comment && m.comment !== 'N/A') {
      rows += '<tr><th>Comment:</th><td>' + esc(m.comment) + '</td></tr>';
    }
    setView(backLink() + '<table id="muscleResults"><tbody>' + rows + '</tbody></table>');
  }

  /* ---------------------------- vessel detail --------------------------- */
  async function renderVessel(kind, id) {
    loading();
    const endpoint = { artery: 'arterymuscles', vein: 'veinmuscles', nerve: 'nervemuscles' }[kind];
    const verb = { artery: 'Supplies:', vein: 'Drains:', nerve: 'Innervates:' }[kind];
    let d;
    try { d = await api(endpoint + '/' + id); } catch { return setView(backLink() + '<p class="muted">Not found.</p>'); }

    const latin = d[kind + '_latinName'];
    const name = d[kind + '_Name'];
    const muscles = d[kind + 'Muscles'] || [];
    const list = muscles.length
      ? muscles.map((mu) => '<a href="#/muscle/' + mu.id + '">' + esc(mu.latinName || mu.name) + '</a>').join('<br>')
      : '<span class="m-none">\u2014</span>';

    // Ancestor path (root -> parent), shown under the names. The current vessel is
    // the title above, so it isn't repeated here.
    const ancestors = (d.path || []).slice(0, -1);
    let pathRow = '';
    if (ancestors.length) {
      const crumb = ancestors.map((p) =>
        '<a href="#/' + kind + '/' + p.id + '">' + esc(p.latinName) + '</a>'
      ).join('<span class="sep">\u203A</span>');
      pathRow = '<tr class="vessel-path-row"><td colspan="2"><div class="vessel-path">' + crumb + '</div></td></tr>';
    }

    let rows = '';
    rows += '<tr class="m-latin"><th colspan="2">' + esc(latin) + '</th></tr>';
    rows += '<tr class="m-english"><th colspan="2">' + esc(name) + '</th></tr>';
    rows += pathRow;
    rows += '<tr class="m-vessel m-' + kind + '"><th>' + verb + '</th><td>' + list + '</td></tr>';
    setView(backLink() + '<table id="muscleResults"><tbody>' + rows + '</tbody></table>');
  }

  /* ----------------------------- group view ----------------------------- */
  function renderGroupNode(node) {
    let html = '<li style="font-weight: bold;">' + esc(node.name) + '</li>';
    if (node.muscles && node.muscles.length) {
      html += '<ul id="ml' + node.id + '">' +
        node.muscles.map((mu) => '<li><a href="#/muscle/' + mu.id + '">' + esc(mu.latinName || mu.name) + '</a></li>').join('') +
        '</ul>';
    }
    if (node.subMuscleGroups && node.subMuscleGroups.length) {
      html += '<ul>' + node.subMuscleGroups.map(renderGroupNode).join('') + '</ul>';
    }
    return html;
  }
  async function renderGroup(id) {
    loading();
    let g;
    try { g = await api('musclegroups/' + id); } catch { return setView(backLink() + '<p class="muted">Group not found.</p>'); }
    setView(backLink() + '<div id="grouplist"><ul>' + renderGroupNode(g) + '</ul></div>');
  }

  /* ------------------------------ about view ---------------------------- */
  function renderAbout() {
    setView(
      '<div id="grouplist"><ul style="list-style:none;">' +
      '<li style="font-weight:bold;">About muscledb</li>' +
      '<li class="muted">A reference for human skeletal muscles — their attachments, function, and ' +
      'the arteries, veins, and nerves associated with each. Browse by anatomical region using the ' +
      'menu above, or search by name.</li>' +
      '<li class="muted" style="margin-top:10px;">Built with a Node.js API over SQLite. ' +
      'Open source under the MIT license.</li>' +
      '</ul></div>'
    );
  }

  /* ================================ QUIZ ================================ */
  /* Spaced-repetition flashcards. Card = one (muscle, field) fact. Schedule is
   * an SM-2-lite scheme persisted in localStorage so progress survives sessions.
   */
  const SRS_KEY = 'muscledb_srs_v1';
  const NEW_PER_SESSION = 20;
  const FIELDS = [
    { key: 'origin', label: 'Origin (origo)?', kind: 'text' },
    { key: 'insertion', label: 'Insertion (insertio)?', kind: 'text' },
    { key: 'function', label: 'Function (functio)?', kind: 'text' },
    { key: 'nerves', label: 'Innervation?', kind: 'nerve' },
    { key: 'arteries', label: 'Arterial supply?', kind: 'artery' },
    { key: 'veins', label: 'Venous drainage?', kind: 'vein' },
  ];

  function srsLoad() { try { return JSON.parse(localStorage.getItem(SRS_KEY)) || {}; } catch { return {}; } }
  function srsSave(s) { try { localStorage.setItem(SRS_KEY, JSON.stringify(s)); } catch (e) { /* storage full/blocked */ } }
  const today = () => new Date().toISOString().slice(0, 10);
  function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  // Build the full card universe from the deck payload, filtered to a region.
  function buildCards(deck, group) {
    const cards = [];
    for (const m of deck) {
      if (group !== 'All' && m.group !== group) continue;
      for (const f of FIELDS) {
        const v = m[f.key];
        const has = f.kind === 'text' ? !!v : Array.isArray(v) && v.length > 0;
        if (!has) continue;
        cards.push({ id: m.id + ':' + f.key, muscle: m.latinName, mEng: m.name, label: f.label, kind: f.kind, answer: v });
      }
    }
    return cards;
  }

  // SM-2-lite: rating 0=Again 1=Hard 2=Good 3=Easy
  function schedule(st, rating) {
    let ease = st.ease || 2.5;
    let interval = st.interval || 0;
    if (rating === 0) {
      ease = Math.max(1.3, ease - 0.2); interval = 0; st.lapses = (st.lapses || 0) + 1;
    } else if (interval === 0) {
      interval = rating === 3 ? 3 : 1;
    } else if (rating === 1) {
      interval = Math.max(1, Math.round(interval * 1.2)); ease = Math.max(1.3, ease - 0.15);
    } else if (rating === 2) {
      interval = Math.round(interval * ease);
    } else {
      interval = Math.round(interval * ease * 1.3); ease += 0.15;
    }
    st.ease = ease; st.interval = interval; st.reps = (st.reps || 0) + 1;
    st.due = addDays(today(), interval);
    return st;
  }

  function answerHtml(card) {
    if (card.kind === 'text') return '<div class="q-ans-text">' + esc(card.answer) + '</div>';
    const cls = card.kind; // artery|vein|nerve -> reuse theme colors
    return '<div class="q-ans-list m-' + cls + '">' +
      card.answer.map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>';
  }

  let quizSession = null; // {queue:[card], srs, deck, group, stats}

  async function renderQuiz() {
    loading();
    let deck;
    try { deck = await api('quiz'); } catch { return setView('<p class="muted">Could not load the deck.</p>'); }
    quizSession = quizSession && quizSession.deck ? quizSession : null;
    const groups = ['All', ...Array.from(new Set(deck.map((m) => m.group).filter(Boolean))).sort()];
    renderQuizSetup(deck, groups);
  }

  function srsStats(deck, group) {
    const srs = srsLoad();
    const cards = buildCards(deck, group);
    let due = 0, fresh = 0, learned = 0;
    for (const c of cards) {
      const st = srs[c.id];
      if (!st) fresh++;
      else { if (st.due <= today()) due++; if ((st.interval || 0) >= 1) learned++; }
    }
    return { total: cards.length, due, fresh, learned };
  }

  function renderQuizSetup(deck, groups) {
    const sel = (window._quizGroup = window._quizGroup || 'All');
    const s = srsStats(deck, sel);
    setView(
      '<div class="quiz-setup">' +
      '<h2 class="quiz-h">Flashcards</h2>' +
      '<p class="muted quiz-sub">Active recall with spaced repetition. Rate yourself honestly — cards you miss come back sooner.</p>' +
      '<label class="quiz-lbl">Region</label>' +
      '<select id="quizGroup">' + groups.map((g) => '<option' + (g === sel ? ' selected' : '') + '>' + esc(g) + '</option>').join('') + '</select>' +
      '<div class="quiz-stats">' +
        '<span><strong>' + s.due + '</strong> due</span>' +
        '<span><strong>' + Math.min(s.fresh, NEW_PER_SESSION) + '</strong> new</span>' +
        '<span><strong>' + s.learned + '</strong>/' + s.total + ' learned</span>' +
      '</div>' +
      '<button id="quizStart" class="quiz-btn quiz-start">Start session</button>' +
      '<button id="quizReset" class="quiz-reset">Reset all progress</button>' +
      '</div>'
    );
    document.getElementById('quizGroup').addEventListener('change', (e) => { window._quizGroup = e.target.value; renderQuizSetup(deck, groups); });
    document.getElementById('quizStart').addEventListener('click', () => startSession(deck, sel));
    document.getElementById('quizReset').addEventListener('click', () => {
      if (confirm('Erase all flashcard progress on this device?')) { srsSave({}); renderQuizSetup(deck, groups); }
    });
  }

  function startSession(deck, group) {
    const srs = srsLoad();
    const cards = buildCards(deck, group);
    const dueCards = [], newCards = [];
    for (const c of cards) {
      const st = srs[c.id];
      if (!st) newCards.push(c);
      else if (st.due <= today()) dueCards.push(c);
    }
    // interleave due + capped new, lightly shuffled
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const queue = shuffle(dueCards).concat(shuffle(newCards).slice(0, NEW_PER_SESSION));
    shuffle(queue);
    if (!queue.length) { renderQuizDone(deck, group, 0); return; }
    quizSession = { queue, srs, deck, group, done: 0, total: queue.length };
    showCard(false);
  }

  function showCard(revealed) {
    const S = quizSession;
    if (!S.queue.length) return renderQuizDone(S.deck, S.group, S.done);
    const card = S.queue[0];
    const progress = S.done + '/' + (S.done + S.queue.length);
    let html = '<div class="quiz-card">' +
      '<div class="q-top"><a href="#/quiz" class="q-quit">\u2039 End</a><span class="q-prog">' + progress + '</span></div>' +
      '<div class="q-muscle">' + esc(card.muscle) + '</div>' +
      '<div class="q-label">' + esc(card.label) + '</div>';
    if (!revealed) {
      html += '<button id="qShow" class="quiz-btn">Show answer</button>';
    } else {
      html += '<div class="q-answer">' + answerHtml(card) + '</div>' +
        '<div class="q-rate">' +
        '<button class="qr qr-again" data-r="0">Again</button>' +
        '<button class="qr qr-hard" data-r="1">Hard</button>' +
        '<button class="qr qr-good" data-r="2">Good</button>' +
        '<button class="qr qr-easy" data-r="3">Easy</button>' +
        '</div>';
    }
    html += '</div>';
    setView(html);
    if (!revealed) {
      document.getElementById('qShow').addEventListener('click', () => showCard(true));
    } else {
      view.querySelectorAll('.qr').forEach((b) => b.addEventListener('click', () => rateCard(+b.dataset.r)));
    }
  }

  function rateCard(rating) {
    const S = quizSession;
    const card = S.queue.shift();
    const st = schedule(S.srs[card.id] || {}, rating);
    S.srs[card.id] = st;
    srsSave(S.srs);
    if (rating === 0) {
      // relearn within this session: reinsert a few cards later
      const at = Math.min(S.queue.length, 4 + Math.floor(Math.random() * 3));
      S.queue.splice(at, 0, card);
    } else {
      S.done++;
    }
    showCard(false);
  }

  function renderQuizDone(deck, group, done) {
    const s = srsStats(deck, group);
    setView(
      '<div class="quiz-done">' +
      '<div class="q-check">\u2713</div>' +
      '<h2 class="quiz-h">' + (done ? 'Session complete' : 'Nothing due right now') + '</h2>' +
      '<p class="muted">' + (done ? 'Reviewed ' + done + ' card' + (done === 1 ? '' : 's') + '. ' : '') +
        s.due + ' due, ' + s.fresh + ' still new in this region.</p>' +
      '<button id="qAgain" class="quiz-btn">Back to start</button>' +
      '</div>'
    );
    document.getElementById('qAgain').addEventListener('click', () => { location.hash = '#/quiz'; renderQuiz(); });
  }

  /* -------------------------------- router ------------------------------ */
  function setActiveNav(hash) {
    if (!navEl) return;
    navEl.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === hash || (hash.startsWith('#/group/') && href === hash));
    });
  }

  function router() {
    const raw = location.hash.slice(1) || '/';
    const parts = raw.split('/').filter(Boolean); // ['muscle','19']
    const section = parts[0];
    const id = parts[1];
    window.scrollTo(0, 0);
    setActiveNav(location.hash || '#/');

    if (!section) return renderSearch();
    switch (section) {
      case 'muscle': return renderMuscle(id);
      case 'group': return renderGroup(id);
      case 'artery': return renderVessel('artery', id);
      case 'vein': return renderVessel('vein', id);
      case 'nerve': return renderVessel('nerve', id);
      case 'about': return renderAbout();
      case 'quiz': return renderQuiz();
      default: return renderSearch();
    }
  }

  /* ------------------------------- version ------------------------------ */
  async function renderVersion() {
    const footer = document.getElementById('version-footer');
    if (!footer) return;
    const debug = new URLSearchParams(location.search).get('debug') === 'true';
    let v;
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      v = res.ok ? await res.json() : null;
    } catch { v = null; }

    if (!v) { footer.textContent = debug ? 'build: dev (no version.json)' : 'dev'; return; }
    if (debug) {
      footer.innerHTML = 'build <strong>' + esc(v.build) + '</strong> · commit ' + esc(v.commit) +
        ' · ' + esc((v.date || '').replace('T', ' ').replace(/\..*$/, '')) + ' UTC';
    } else {
      footer.textContent = 'build ' + v.build;
      footer.title = v.commit + ' · ' + (v.date || '');
    }
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', () => { router(); renderVersion(); });
  // If DOMContentLoaded already fired (script at end of body), run now.
  if (document.readyState !== 'loading') { router(); renderVersion(); }
})();
