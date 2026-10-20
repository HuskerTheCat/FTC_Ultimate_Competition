// Demo backend: the same functions as firebase.js, backed by sample data in memory.
// Nothing is saved; reloading the page starts the demo over.

const USER = { uid: 'demo', email: 'husker@example.com', emailVerified: true };
const TEAM = { name: '12345 Example Team', secret: 'demoSecret', owner: USER.uid };
const members = [
  { uid: USER.uid, email: USER.email, name: 'Husker' },
  { uid: 'scout2', email: 'scout@example.com', name: 'Sam' },
];
const memberListeners = new Set();

export function connect() {}

// Signed in straight away as the demo member.
export function watchUser(callback) {
  setTimeout(() => callback(USER));
  return () => {};
}

export const signIn = async () => {};
export const signUp = async () => {};
export const resetPassword = async () => {};
export const sendVerification = async () => {};
export const checkVerified = async () => true;
// Signing out leaves the demo for the welcome screen.
export const logOut = async () => { location.href = location.pathname; };
export const clearDeviceData = async () => {};

export const ensureMembership = async () => false;
export const rulesUpToDate = async () => true;
export const rulesOpen = async () => false;
export const getTeam = async () => TEAM;
export const saveOwnerKey = async () => {};
export const getOwnerKey = async () => 'demo';
export const setJoinInfo = async () => {};

export function watchMembers(callback) {
  const listener = () => callback(members.map((m) => ({ ...m })));
  memberListeners.add(listener);
  listener();
  return () => memberListeners.delete(listener);
}

export async function setMyName(uid, name) {
  members.find((m) => m.uid === uid).name = name;
  memberListeners.forEach((listener) => listener());
}
