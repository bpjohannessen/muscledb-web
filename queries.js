'use strict';

/*
 * Query + shaping layer — targets the current ("v2") database schema:
 *   muscles(id,name,lat_name,origin,insertion,function,comment,image,group_id)
 *   groups(id,name,lat_name,parent_id,explanation)
 *   arteries/veins/nerves(id,name,lat_name,parent_id)
 *   muscle_arteries(muscle_id,artery_id) / muscle_veins / muscle_nerves
 *
 * No database views or FTS tables are required: the group hierarchy is computed
 * with inline recursive CTEs and search uses LIKE. That means a future database
 * with this same schema can be dropped in as a plain file replacement.
 *
 * Response shapes are unchanged from the original API, so the front-end works.
 */

const { query, queryOne } = require('./db');

function isMissing(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === '' || s.toUpperCase() === 'UNDEFINED';
}

/* ------------------------------ search ------------------------------ */
// GET /api/muscles?searchterm=...
function searchMuscles(searchTerm) {
  if (!searchTerm) {
    return query('SELECT id, "function" AS functio, lat_name AS latinName, name FROM muscles ORDER BY name');
  }
  const p = '%' + searchTerm + '%';
  return query(
    `SELECT id, "function" AS functio, lat_name AS latinName, name FROM muscles
     WHERE name LIKE ? OR lat_name LIKE ? OR origin LIKE ? OR insertion LIKE ? OR "function" LIKE ?
     ORDER BY name`,
    p, p, p, p, p
  );
}

/* --------------------------- muscle detail -------------------------- */
const LINK_SQL = {
  artery: `SELECT a.id, a.name, a.lat_name AS latinName
             FROM muscle_arteries ma JOIN arteries a ON a.id = ma.artery_id
            WHERE ma.muscle_id = ? ORDER BY a.name`,
  vein:   `SELECT v.id, v.name, v.lat_name AS latinName
             FROM muscle_veins mv JOIN veins v ON v.id = mv.vein_id
            WHERE mv.muscle_id = ? ORDER BY v.name`,
  nerve:  `SELECT n.id, n.name, n.lat_name AS latinName
             FROM muscle_nerves mn JOIN nerves n ON n.id = mn.nerve_id
            WHERE mn.muscle_id = ? ORDER BY n.name`,
};

// Ancestor chain of a group, top-most first (mirrors old view_grouptree usage).
const GROUP_ANCESTORS_SQL = `
WITH RECURSIVE anc(id, name, lat_name, parent_id, lvl) AS (
  SELECT g.id, g.name, g.lat_name, g.parent_id, 0 FROM groups g WHERE g.id = ?
  UNION ALL
  SELECT g.id, g.name, g.lat_name, g.parent_id, anc.lvl + 1
    FROM groups g JOIN anc ON g.id = anc.parent_id
)
SELECT id, name, lat_name AS latinName FROM anc ORDER BY lvl DESC`;

// GET /api/muscles/:id
function muscleById(id) {
  const m = queryOne(
    `SELECT id, origin AS origo, insertion AS insertio, "function" AS functio,
            name, lat_name AS latinName, image, ifnull(comment,'N/A') AS comment, group_id
       FROM muscles WHERE id = ?`,
    id
  );
  if (!m) return null;

  const muscleArteries = query(LINK_SQL.artery, id);
  const muscleVeins = query(LINK_SQL.vein, id);
  const muscleNerves = query(LINK_SQL.nerve, id);
  const muscleGroups = query(GROUP_ANCESTORS_SQL, m.group_id);

  // Legacy single-value fields (kept for API compatibility; the detail page
  // renders the collections above, not these).
  const firstVein = muscleVeins.find((v) => !isMissing(v.latinName));
  const firstNerve = muscleNerves.find((n) => !isMissing(n.latinName));

  return {
    id: m.id,
    origo: m.origo,
    insertio: m.insertio,
    functio: m.functio,
    latinName: m.latinName,
    name: m.name,
    image: m.image,
    comment: m.comment,
    vein_Id: firstVein ? firstVein.id : null,
    vein: firstVein ? firstVein.latinName : null,
    nerve_Id: firstNerve ? firstNerve.id : null,
    nerve: firstNerve ? firstNerve.latinName : null,
    muscleArteries,
    muscleVeins,
    muscleNerves,
    muscleGroups,
  };
}

/* --------------------------- group hierarchy ------------------------ */
// All descendant groups of :id (top-down) with their muscles.
const GROUP_TREE_SQL = `
WITH RECURSIVE tree(id, name, lat_name, parent_id, lvl) AS (
  SELECT g.id, g.name, g.lat_name, g.parent_id, 0 FROM groups g WHERE g.id = ?
  UNION ALL
  SELECT g.id, g.name, g.lat_name, g.parent_id, tree.lvl + 1
    FROM groups g JOIN tree ON g.parent_id = tree.id
)
SELECT t.id AS Id, t.name AS Name, t.lat_name AS LatinName, t.parent_id AS ParentId, t.lvl,
       m.id AS Muscles_Id, m.name AS Muscles_Name, m.lat_name AS Muscles_LatinName
  FROM tree t
  LEFT JOIN muscles m ON m.group_id = t.id
 ORDER BY t.lvl ASC, t.id ASC, m.id ASC`;

// GET /api/musclegroups/:id
function muscleGroupHierarchy(groupId) {
  const rows = query(GROUP_TREE_SQL, groupId);
  if (rows.length === 0) return null;

  const order = [];
  const byId = new Map();
  for (const r of rows) {
    let node = byId.get(r.Id);
    if (!node) {
      node = {
        id: r.Id, name: r.Name, latinName: r.LatinName, parentId: r.ParentId,
        muscles: [], subMuscleGroups: [], _mids: new Set(),
      };
      byId.set(r.Id, node);
      order.push(node);
    }
    if (r.Muscles_Id != null && !node._mids.has(r.Muscles_Id)) {
      node._mids.add(r.Muscles_Id);
      node.muscles.push({ id: r.Muscles_Id, name: r.Muscles_Name, latinName: r.Muscles_LatinName });
    }
  }
  for (const node of order) {
    if (node.parentId != null && byId.has(node.parentId) && node.parentId !== node.id) {
      byId.get(node.parentId).subMuscleGroups.push(node);
    }
  }
  order.forEach((n) => delete n._mids);
  return order[0];
}

/* ----------------------- arteries / veins / nerves ------------------ */
function vesselById(table, linkTable, linkCol, id) {
  const row = queryOne(`SELECT id, name, lat_name AS latinName FROM ${table} WHERE id = ?`, id);
  if (!row) return null;
  const muscles = query(
    `SELECT m.id, m.name, m.lat_name AS latinName
       FROM ${linkTable} lk JOIN muscles m ON m.id = lk.muscle_id
      WHERE lk.${linkCol} = ? ORDER BY m.name`,
    id
  );
  // Ancestor path, root -> current (inclusive). lvl guard prevents runaway on any bad cycle.
  const path = query(
    `WITH RECURSIVE anc(id, lat_name, parent_id, lvl) AS (
       SELECT id, lat_name, parent_id, 0 FROM ${table} WHERE id = ?
       UNION ALL
       SELECT t.id, t.lat_name, t.parent_id, anc.lvl + 1
         FROM ${table} t JOIN anc ON t.id = anc.parent_id
        WHERE anc.lvl < 50
     )
     SELECT id, lat_name AS latinName FROM anc ORDER BY lvl DESC`,
    id
  );
  return { row, muscles, path };
}

function arteryById(id) {
  const r = vesselById('arteries', 'muscle_arteries', 'artery_id', id);
  if (!r) return null;
  return { id: r.row.id, artery_Name: r.row.name, artery_latinName: r.row.latinName, arteryMuscles: r.muscles, path: r.path };
}
function veinById(id) {
  const r = vesselById('veins', 'muscle_veins', 'vein_id', id);
  if (!r) return null;
  return { id: r.row.id, vein_Name: r.row.name, vein_latinName: r.row.latinName, veinMuscles: r.muscles, path: r.path };
}
function nerveById(id) {
  const r = vesselById('nerves', 'muscle_nerves', 'nerve_id', id);
  if (!r) return null;
  return { id: r.row.id, nerve_Name: r.row.name, nerve_latinName: r.row.latinName, nerveMuscles: r.muscles, path: r.path };
}

/* ------------------------------ quiz deck --------------------------- */
// GET /api/quiz — one compact payload with everything the flashcard deck needs.
function quizDeck() {
  const rows = query(
    `SELECT m.id, m.lat_name AS latinName, m.name,
            m.origin, m.insertion, m."function" AS func,
            g.name AS grp,
            (SELECT GROUP_CONCAT(a.lat_name, '|')
               FROM muscle_arteries ma JOIN arteries a ON a.id = ma.artery_id
              WHERE ma.muscle_id = m.id) AS arteries,
            (SELECT GROUP_CONCAT(v.lat_name, '|')
               FROM muscle_veins mv JOIN veins v ON v.id = mv.vein_id
              WHERE mv.muscle_id = m.id) AS veins,
            (SELECT GROUP_CONCAT(n.lat_name, '|')
               FROM muscle_nerves mn JOIN nerves n ON n.id = mn.nerve_id
              WHERE mn.muscle_id = m.id) AS nerves
       FROM muscles m LEFT JOIN groups g ON g.id = m.group_id
      ORDER BY m.id`
  );
  const clean = (s) => (isMissing(s) ? null : String(s).trim());
  const list = (s) => (isMissing(s) ? [] : String(s).split('|').filter((x) => !isMissing(x)));
  return rows.map((r) => ({
    id: r.id,
    latinName: r.latinName,
    name: r.name,
    group: r.grp || null,
    origin: clean(r.origin),
    insertion: clean(r.insertion),
    function: clean(r.func),
    arteries: list(r.arteries),
    veins: list(r.veins),
    nerves: list(r.nerves),
  }));
}

module.exports = {
  searchMuscles, muscleById, muscleGroupHierarchy, arteryById, veinById, nerveById, quizDeck,
};
