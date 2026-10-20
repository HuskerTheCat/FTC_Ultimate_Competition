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

// Two routes that meet at the middle of the field, so the player shows a collision.
const ROBOT = { width: 18, length: 18, speed: 60, turnSpeed: 270 };
const routes = new Map([
  ['left', {
    name: 'Left wall, hive tip', season: '2027', phase: 'auto', alliance: 'red', team: 12345, robot: ROBOT, shared: false,
    start: { x: 9, y: 72, h: 0 },
    steps: [{ x: 40, y: 72, h: 0, action: 'hiveTip', wait: 1 }, { x: 40, y: 110, h: 90, action: null, wait: 0 }, { x: 20, y: 30, h: 0, action: 'park', wait: 0 }],
  }],
  ['partner', {
    name: 'Far side sweep', season: '2027', phase: 'auto', alliance: 'blue', team: 67890, robot: { ...ROBOT, speed: 45 }, shared: true,
    start: { x: 135, y: 72, h: 180 },
    steps: [{ x: 104, y: 72, h: 180, action: 'hiveTip', wait: 0 }, { x: 104, y: 30, h: 270, action: null, wait: 0 }, { x: 34, y: 30, h: 180, action: 'park', wait: 0 }],
  }],
]);
const routeListeners = new Set();
let nextRoute = 1;
const routesChanged = () => routeListeners.forEach((listener) => listener());

export function watchRoutes(callback) {
  const listener = () => callback([...routes].map(([id, route]) => structuredClone({ id, ...route })));
  routeListeners.add(listener);
  listener();
  return () => routeListeners.delete(listener);
}

export function saveRoute(id, route) {
  const routeId = id ?? `route${nextRoute++}`;
  routes.set(routeId, structuredClone(route));
  setTimeout(routesChanged);
  return routeId;
}

export async function deleteRoute(id) {
  routes.delete(id);
  routesChanged();
}
