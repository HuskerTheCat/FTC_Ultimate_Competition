// Which team this device is on, and how it got there: a join code or link, the team number, or setting up a new team.
// A connection is { config, teamName, secret?, program?, teamNumber?, role }, saved on this device only.
// Join codes, join links and team numbers are the same as Inventory's, so one works in every FTC Ultimate app.
import * as fb from './firebase.js';
import { decodeJoinCode, findTeam, newSecret } from './joincode.js';
import { findTeamProject, recordTeam, teamProject } from './hub.js';

// Scout's own key: both websites are on huskerthecat.github.io and share localStorage with Inventory.
const STORAGE_KEY = 'ftc-scout-connection';

export const loadConnection = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

// Firebase can only be started once per page, so the app restarts on the new team.
function saveConnection(connection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  location.reload();
}

export function forgetConnection() {
  localStorage.removeItem(STORAGE_KEY);
  location.hash = '';
  location.reload();
}

// The join QR code holds the join link (…#join=CODE); anything else is taken as a typed join code.
const joinCodeFrom = (text) => new URLSearchParams(text.split('#')[1]).get('join') ?? text;

export const connectByCode = async (text) => saveConnection({ ...await decodeJoinCode(joinCodeFrom(text)), role: 'member' });

export async function connectByNumber(program, teamNumber) {
  saveConnection({ ...await findTeam(await findTeamProject(program, teamNumber)), program, teamNumber, role: 'member' });
}

// A new team from Set up a new team, after setupProblems (setup.js) found nothing to fix. The owner's first sign-in creates it.
export const connectNewTeam = (config, teamName, program, teamNumber) =>
  saveConnection({ config, secret: newSecret(), teamName, program, teamNumber, role: 'owner' });

// The Firebase project from Set up a new team already has a team (made here or in another FTC Ultimate app).
export async function connectExistingTeam(projectId, program, teamNumber) {
  saveConnection({ ...await findTeam(projectId), program, teamNumber, role: 'member' });
}

// The team a join link (…#join=CODE) opens, taken out of the address bar. Null when the app wasn't opened from one.
export async function teamFromLink() {
  const code = new URLSearchParams(location.hash.slice(1)).get('join');
  if (!code) return null;
  history.replaceState(null, '', location.pathname);
  return decodeJoinCode(code);
}

// When the device is on another team, the app asks before calling this. Already on this team: keep the connection
// and add the secret, so someone new on this device can join with it.
export function connectFromLink(current, joining) {
  if (current?.config.projectId === joining.config.projectId) return saveConnection({ ...current, secret: joining.secret });
  saveConnection({ ...joining, role: 'member' });
}

// Run after each sign-in: puts the user on the team (creating it on the owner's first sign-in), then forgets the join secret.
// Throws an error with code 'unverified' when the user still has to confirm their email.
// The writes that can wait (offline, they finish when the device reconnects) report their errors to onError.
export async function joinTeam(user, connection, name, acceptedPrivacy, onError) {
  const createdTeam = await fb.ensureMembership(user, connection, name, acceptedPrivacy);
  // Signing in by team number reads join/info, so it must exist before anyone tries.
  if (createdTeam) fb.setJoinInfo(connection.config, connection.teamName).catch(onError);
  registerTeam(user, connection).catch(onError);
  forgetSecret(connection);
}

// The join secret is only needed to join. Once in, this device forgets it, so the next person to use it can't join with it.
function forgetSecret(connection) {
  if (!connection.secret) return;
  delete connection.secret;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}

// Puts the team on the developer's team list (see hub.js), so teammates can sign in by team number.
// Checked each time the owner opens the app on a device that knows the team number (set up there, signed in by number,
// or signed in from Set up a new team), so a try that failed (say, offline) is made again, a team that went missing
// from the list is put back, and the owner hears about it when the number is already taken.
// The owner key is saved in the team's own project first, so the owner can always take the team off the list later.
// A team already listed from another FTC Ultimate app is left as it is. Test teams on the local emulators
// ("demo-" project IDs) stay off the real list.
async function registerTeam(user, { teamName, program, teamNumber, config }) {
  if (!teamNumber || config.projectId.startsWith('demo-') || !navigator.onLine) return;
  if ((await fb.getTeam()).owner !== user.uid) return;
  if (await teamProject(program, teamNumber) === config.projectId) return;
  let ownerKey = await fb.getOwnerKey();
  if (!ownerKey) {
    ownerKey = newSecret();
    await fb.saveOwnerKey(ownerKey);
  }
  await recordTeam(teamName, program, teamNumber, config.projectId, ownerKey).catch((error) => {
    if (error.code !== 'permission-denied') throw error;
    throw new Error(`${program} team ${teamNumber} is already on the central server's team list, so teammates can't sign in by team number. They can still join with the join code. Use Report bug to get it fixed.`);
  });
}
