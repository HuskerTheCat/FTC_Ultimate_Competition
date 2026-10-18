import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

// The app developer's own Firebase project, separate from every team's and shared by every FTC Ultimate app.
// It lists each team's name, program, number and Firebase project, so teammates can sign in by team number in any of
// the apps. Anyone can add to it and nobody can read it from the app, except looking up one team's Firebase project by
// its number. The developer reads it in the Firebase console. Its security rules are hub.rules in FTC_Ultimate_Inventory.
const HUB_CONFIG = {
  apiKey: 'AIzaSyAbyvOD4lczELqE9A0dZLVAK_4JtSFXMZE',
  authDomain: 'ultimate-inventory-hub.firebaseapp.com',
  projectId: 'ultimate-inventory-hub',
  appId: '1:908383641585:web:d54c6f082d071d3f35ae50',
};

const db = getFirestore(initializeApp(HUB_CONFIG, 'hub'));

export const PROGRAMS = ['FTC', 'FRC', 'FLL', 'Other'];

// FTC and FRC numbers overlap, so other programs' docs are named "frc-254". FTC docs keep the plain number,
// since every team recorded before programs existed is an FTC team.
const teamKey = (program, number) => (program === 'FTC' ? String(number) : `${program.toLowerCase()}-${number}`);

// Only team-level info, never anything about a person.
// Each team is in one list at a time: teams while the team uses the apps, deleted after it deletes itself.
// A move deletes the team from one list and adds it to the other in one write, as the rules require.
// The owner key comes with the team and must be shown to take it off the list, so only the team's owner can.
async function moveTeam(from, to, data, ownerKey) {
  const key = teamKey(data.program, data.number);
  const batch = writeBatch(db);
  batch.delete(doc(db, from, key));
  batch.set(doc(db, to, key), { ...data, ...(to === 'deleted' && { ownerKey }), at: serverTimestamp() });
  if (to === 'teams') batch.set(doc(db, 'owners', key), { ownerKey });
  else batch.delete(doc(db, 'owners', key));
  await batch.commit();
}

// A new team, a deleted team signing up again under the same number, or a team put back after it went missing from
// the list (its owner key is the same, so the rules let it be written again). The rules refuse a team that's active.
export const recordTeam = (name, program, number, projectId, ownerKey) =>
  moveTeam('deleted', 'teams', { name, program, number, projectId }, ownerKey);

// The Firebase project a team is listed under, or undefined when it isn't on the list.
export const teamProject = async (program, number) =>
  (await getDoc(doc(db, 'teams', teamKey(program, number)))).data()?.projectId;

// Lets teammates sign in on a new device with their team number instead of a join code.
export async function findTeamProject(program, number) {
  const projectId = await teamProject(program, number);
  if (!projectId) throw new Error(`${program} team ${number} can't sign in by number yet. Join with your team's join code instead. Team admins can sign in from Set up a new team.`);
  return projectId;
}
