// Checks a new team's Firebase project before the team is created, so a missed setup step shows up as what to fix
// instead of as a failed sign-in later. Reads without signing in, over Firebase's REST APIs, like joincode.js.
import RULES from '../firestore.rules?raw';

export { RULES };

// Pages of the team's own project in the Firebase console.
export const consolePage = (projectId, page) => `https://console.firebase.google.com/project/${projectId}/${page}`;
export const AUTH_PAGE = 'authentication/providers';
export const RULES_PAGE = 'firestore/databases/-default-/rules';
const DATABASE_PAGE = 'firestore';
const SETTINGS_PAGE = 'settings/general';

// What Firebase Auth answers a sign-in with when email sign-in is off, or Authentication was never started.
export const AUTH_OFF_CODES = ['auth/operation-not-allowed', 'auth/configuration-not-found'];
const AUTH_OFF = /^(CONFIGURATION_NOT_FOUND|OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED)/;

async function get(url, init) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('Can’t reach Firebase. Check your internet connection.');
  }
}

// Firebase reserves "demo-" project IDs for the local emulators (npm run emulators).
const local = (projectId) => projectId.startsWith('demo-');

// Signs in as a made-up user: the answer says whether email sign-in is on, without making an account.
async function authProblem({ apiKey, projectId }) {
  const host = local(projectId) ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com' : 'https://identitytoolkit.googleapis.com';
  const response = await get(`${host}/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'setup-check@example.com', password: 'setup-check' }),
  });
  const { message } = (await response.json()).error;
  if (message.startsWith('API key not valid')) return { step: 4, text: 'The pasted connection info doesn’t match a Firebase project. Copy the firebaseConfig again.', page: SETTINGS_PAGE };
  if (AUTH_OFF.test(message)) return { step: 2, text: 'Email/Password sign-in isn’t turned on.', page: AUTH_PAGE };
  return null;
}

// Reads one doc: 'exists', 'allowed' (no such doc, but the rules let anyone read it), 'denied' by the rules,
// or 'no-database' (Firestore not created yet, or the project ID is wrong).
async function readDoc(projectId, path) {
  const host = local(projectId) ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
  const response = await get(`${host}/v1/projects/${projectId}/databases/(default)/documents/${path}`);
  if (response.ok) return 'exists';
  const { message, details } = (await response.json()).error;
  if (response.status === 404 && message.startsWith('Document')) return 'allowed';
  // A project without Firestore, or a wrong project ID, answers 403 too, but with details saying why. The rules' 403 has none.
  if (response.status === 403 && !details) return 'denied';
  return 'no-database';
}

// The app's rules let anyone read join/info (it has to be readable to join) and no one read rulesCheck/open (see firebase.js).
async function databaseProblem(projectId) {
  const join = await readDoc(projectId, 'join/info');
  if (join === 'no-database') return { step: 3, text: 'There’s no Firestore database yet.', page: DATABASE_PAGE };
  if (join === 'denied') return { step: 3, text: 'The app’s rules aren’t published yet.', page: RULES_PAGE };
  // The owner can sign in to it from here, which also puts it back on the central team list if it went missing (see main.js).
  if (join === 'exists') return { text: 'This Firebase project already has a team.', existingTeam: true };
  if (await readDoc(projectId, 'rulesCheck/open') !== 'denied') {
    return { step: 3, text: 'The published rules let anyone read your team’s data (test mode). Publish the app’s rules instead.', page: RULES_PAGE };
  }
  return null;
}

// The setup steps still to do, as { step, text, page } with a console page to fix each in. Empty when the project is ready.
export async function setupProblems(config) {
  const problems = await Promise.all([authProblem(config), databaseProblem(config.projectId)]);
  return problems.filter(Boolean);
}
