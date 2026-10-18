// A join code is the team's Firebase project ID plus the team's secret, e.g. "ftc-inv-4f2a1-k7qm3x9p2r".
// The rest of the Firebase config and the team name are read from the team's public join/info doc.

const CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];
const SECRET_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 characters, so every byte maps evenly

// Accepts the `firebaseConfig = { ... }` snippet Firebase shows, or plain JSON.
export function parseFirebaseConfig(text) {
  const config = {};
  for (const key of CONFIG_KEYS) {
    const match = text.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`));
    if (!match) throw new Error(`Couldn't find "${key}" in the pasted Firebase config.`);
    config[key] = match[1];
  }
  return config;
}

export const encodeJoinCode = ({ projectId, secret }) => `${projectId}-${secret}`;

export async function decodeJoinCode(code) {
  const match = code.trim().toLowerCase().match(/^([a-z0-9-]+)-([a-z0-9]{10,})$/);
  if (!match) throw new Error('That join code is not valid. Ask your team admin to copy it again.');
  const [, projectId, secret] = match;
  return { ...await findTeam(projectId), secret };
}

// The team's Firebase config and name, from its public join/info doc.
export async function findTeam(projectId) {
  const { name, ...config } = await fetchJoinInfo(projectId);
  return { config: { ...config, projectId }, teamName: name };
}

// Read without signing in, over Firestore's REST API, since the app can't start Firebase without the API key.
async function fetchJoinInfo(projectId) {
  // Firebase reserves "demo-" project IDs for the local emulators (npm run emulators).
  const host = projectId.startsWith('demo-') ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
  const response = await fetch(`${host}/v1/projects/${projectId}/databases/(default)/documents/join/info`);
  if (!response.ok) throw new Error('No team found. Ask your team admin for the join code.');
  const { fields } = await response.json();
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.stringValue]));
}

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => SECRET_CHARS[b % SECRET_CHARS.length]).join('');
}
