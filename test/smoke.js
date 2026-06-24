'use strict';

// Schema-agnostic smoke test: derives valid ids from the data, so it works on
// any database that follows the current schema. Run: node test/smoke.js
// (add --experimental-sqlite on Node < 22.5 without better-sqlite3).

const assert = require('assert');
const q = require('../queries');
const { query } = require('../db');

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log(`  ok  ${name}`); }

const anyMuscle = query('SELECT id FROM muscles ORDER BY id LIMIT 1')[0].id;
const anyGroup = query('SELECT id FROM groups WHERE parent_id IS NULL ORDER BY id LIMIT 1')[0].id;
const anyArtery = query('SELECT artery_id AS id FROM muscle_arteries LIMIT 1')[0].id;
const anyVein = query('SELECT vein_id AS id FROM muscle_veins LIMIT 1')[0].id;
const anyNerve = query('SELECT nerve_id AS id FROM muscle_nerves LIMIT 1')[0].id;

check('search returns all muscles when term empty', () => {
  const all = q.searchMuscles('');
  assert(all.length > 150, `got ${all.length}`);
  assert('id' in all[0] && 'name' in all[0] && 'latinName' in all[0] && 'functio' in all[0]);
});
check('search matches a term', () => {
  const r = q.searchMuscles('biceps');
  assert(r.length >= 2 && r.every((m) => /biceps/i.test(m.latinName) || /biceps/i.test(m.name)));
});
check('muscle detail has nested collections', () => {
  const m = q.muscleById(anyMuscle);
  assert(m && m.id === anyMuscle);
  for (const k of ['origo', 'insertio', 'functio', 'latinName', 'name', 'image',
                   'muscleArteries', 'muscleVeins', 'muscleNerves', 'muscleGroups']) assert(k in m);
  for (const k of ['muscleArteries', 'muscleVeins', 'muscleNerves', 'muscleGroups']) assert(Array.isArray(m[k]));
  assert(m.muscleGroups.length >= 1);
});
check('missing muscle returns null', () => assert(q.muscleById(999999) === null));
check('group hierarchy is a nested tree', () => {
  const g = q.muscleGroupHierarchy(anyGroup);
  assert(g && Array.isArray(g.subMuscleGroups) && Array.isArray(g.muscles));
});
check('artery detail shape', () => {
  const a = q.arteryById(anyArtery);
  assert(a && 'artery_Name' in a && 'artery_latinName' in a && Array.isArray(a.arteryMuscles));
});
check('vein detail shape', () => {
  const v = q.veinById(anyVein);
  assert(v && 'vein_Name' in v && 'vein_latinName' in v && Array.isArray(v.veinMuscles));
});
check('nerve detail shape', () => {
  const n = q.nerveById(anyNerve);
  assert(n && 'nerve_Name' in n && 'nerve_latinName' in n && Array.isArray(n.nerveMuscles));
});

console.log(`\n${passed} checks passed.`);
