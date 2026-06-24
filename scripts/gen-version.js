'use strict';

/*
 * Writes public/version.json from git metadata.
 *   build  — incrementing integer (number of commits)
 *   commit — short hash
 *   date   — build time (UTC, ISO)
 *
 * Run locally with `npm run version`, and in CI before deploy. If git isn't
 * available, falls back to a "dev" marker so the app still works.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function git(cmd, fallback) {
  try {
    return execSync('git ' + cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

const info = {
  build: parseInt(git('rev-list --count HEAD', '0'), 10) || 0,
  commit: git('rev-parse --short HEAD', 'dev'),
  date: new Date().toISOString(),
};

const out = path.join(__dirname, '..', 'public', 'version.json');
fs.writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log('Wrote', out, '->', info);
