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
      '<tr><td id="muscleResultItem"><a href="#/muscle/' + m.id + '">' + esc(m.latinName) + ' (' + esc(m.name) + ')</a></td></tr>'
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

    let rows = '';
    rows += '<tr class="m-latin"><th colspan="2">' + esc(latin) + '</th></tr>';
    rows += '<tr class="m-english"><th colspan="2">' + esc(name) + '</th></tr>';
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
