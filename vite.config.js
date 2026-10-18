import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

// The rules version this app needs, from Scout's number at the top of firestore.rules (see rulesUpToDate in src/firebase.js).
const rulesMatch = readFileSync('firestore.rules', 'utf8').match(/function scoutRulesVersion\(\) \{ return (\d+); \}/);
if (!rulesMatch) throw new Error('firestore.rules has no scoutRulesVersion() line');

// Relative paths so the same build works on GitHub Pages, in Electron (file://) and in Capacitor.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version), __RULES_VERSION__: rulesMatch[1] },
});
