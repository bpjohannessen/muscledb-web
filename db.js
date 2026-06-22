'use strict';

/*
 * Database access layer.
 *
 * Prefers the well-known `better-sqlite3` package (prebuilt binaries on Linux,
 * so `npm install` does not need a compiler). If it is not installed, falls back
 * to Node's built-in SQLite module (Node >= 22.5). Either way the rest of the
 * app uses the same tiny interface: `query(sql, ...params)` and
 * `queryOne(sql, ...params)`.
 */

const path = require('path');

const DB_PATH = process.env.MUSCLEDB_PATH || path.join(__dirname, 'db', 'muscles.db');

let impl;

function init() {
  if (impl) return impl;

  try {
    // Preferred driver.
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    impl = {
      driver: 'better-sqlite3',
      all: (sql, params) => db.prepare(sql).all(...params),
      get: (sql, params) => db.prepare(sql).get(...params),
    };
    return impl;
  } catch (err) {
    if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
  }

  // Fallback: Node built-in SQLite (experimental, Node >= 22.5).
  // eslint-disable-next-line global-require
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  impl = {
    driver: 'node:sqlite',
    all: (sql, params) => db.prepare(sql).all(...params),
    get: (sql, params) => db.prepare(sql).get(...params),
  };
  return impl;
}

function query(sql, ...params) {
  return init().all(sql, params);
}

function queryOne(sql, ...params) {
  return init().get(sql, params);
}

function driverName() {
  return init().driver;
}

module.exports = { query, queryOne, driverName, DB_PATH };
