// Demo backend: the same functions as firebase.js, backed by sample data in memory.
// Nothing is saved; reloading the page starts the demo over.

const USER = { uid: 'demo', email: 'husker@example.com', emailVerified: true };
const TEAM = { name: '12345 Example Team', secret: 'demoSecret', owner: USER.uid };
const members = [
  { uid: USER.uid, email: USER.email, name: 'Husker' },
  { uid: 'gabby', email: 'gabby@example.com', name: 'Gabby' },
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

// A few scouted matches so the Teams tab has something to rank.
const counts = (auto, teleop) => ({ auto, teleop });
const matches = new Map([
  ['m1', { season: '2027', event: 'Demo Qualifier', match: 1, team: 67890, alliance: 'blue', scout: 'gabby', notes: 'Fast cycles, missed park.',
    counts: counts({ leave: 1, hiveTip: 1 }, { cell: 9, flower: 4, minor: 1 }), points: { auto: 23, teleop: 26, fouls: 5 } }],
  ['m2', { season: '2027', event: 'Demo Qualifier', match: 1, team: 11111, alliance: 'red', scout: 'demo', notes: '',
    counts: counts({ leave: 1 }, { cell: 4, garden: 6, park: 1 }), points: { auto: 3, teleop: 19, fouls: 0 } }],
  ['m3', { season: '2027', event: 'Demo Qualifier', match: 4, team: 67890, alliance: 'red', scout: 'demo', notes: 'Tipped the hive in auto again.',
    counts: counts({ leave: 1, hiveTip: 1, park: 1 }, { cell: 11, nectarBonus: 1, park: 1 }), points: { auto: 28, teleop: 32, fouls: 0 } }],
  // Gabby watched 67890 in match 4 too, so the team page averages the two scouts.
  ['m5', { season: '2027', event: 'Demo Qualifier', match: 4, team: 67890, alliance: 'red', scout: 'gabby', notes: 'Slow last 30 seconds.',
    counts: counts({ leave: 1, hiveTip: 1, park: 1 }, { cell: 9, park: 1 }), points: { auto: 28, teleop: 23, fouls: 0 } }],
  ['m4', { season: '2027', event: 'Demo Qualifier', match: 4, team: 22222, alliance: 'blue', scout: 'gabby', notes: 'Pushed into our robot.',
    counts: counts({}, { garden: 8, major: 1 }), points: { auto: 0, teleop: 8, fouls: 20 } }],
]);
const buttons = new Map([['defended', { label: 'Played defense', points: 0 }]]);
// 67890 oversells its teleop in the pits; 33333 was only pit scouted.
const pits = new Map([
  ['67890', { season: '2027', team: 67890, by: 'gabby', drivetrain: 'Mecanum', notes: 'Says they never miss the hive tip.',
    claims: counts({ leave: 1, hiveTip: 1, park: 1 }, { cell: 14, flower: 4, park: 1 }) }],
  ['33333', { season: '2027', team: 33333, by: 'demo', drivetrain: 'Tank', notes: 'New team, parks every match.',
    claims: counts({ leave: 1, park: 1 }, { garden: 6, park: 1 }) }],
]);
const pitListeners = new Set();
const matchListeners = new Set();
const buttonListeners = new Set();
let nextId = 1;
const watch = (map, listeners) => (callback) => {
  const listener = () => callback([...map].map(([id, item]) => structuredClone({ id, ...item })));
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
};

export const watchMatches = watch(matches, matchListeners);
export const watchButtons = watch(buttons, buttonListeners);
export const watchPits = watch(pits, pitListeners);

export function savePit(pit) {
  pits.set(String(pit.team), { ...structuredClone(pit), by: USER.uid });
  setTimeout(() => pitListeners.forEach((listener) => listener()));
}

export function saveMatch(match) {
  matches.set(`match${nextId++}`, { ...structuredClone(match), scout: USER.uid });
  setTimeout(() => matchListeners.forEach((listener) => listener()));
}

export async function deleteMatch(id) {
  matches.delete(id);
  matchListeners.forEach((listener) => listener());
}

export function saveButton(button) {
  const id = `button${nextId++}`;
  buttons.set(id, { ...button });
  setTimeout(() => buttonListeners.forEach((listener) => listener()));
  return id;
}

export async function deleteButton(id) {
  buttons.delete(id);
  buttonListeners.forEach((listener) => listener());
}
