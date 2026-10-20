import { initializeApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager, terminate, clearIndexedDbPersistence,
  doc, collection, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

let auth;
let db;

// Scout shares each team's Firebase project with FTC Ultimate Inventory (see SUITE.md), and both websites share
// browser storage on huskerthecat.github.io. A named app gives Scout its own sign-in record and offline cache there,
// so signing out of one app doesn't sign out the other and the two apps' Firebase versions never share a cache.
export function connect(config) {
  const app = initializeApp(config, 'scout');
  auth = getAuth(app);
  // Local cache keeps the app usable offline; edits sync when the device reconnects.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  // Firebase reserves "demo-" project IDs for the local emulators (npm run emulators).
  if (config.projectId.startsWith('demo-')) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export const watchUser = (callback) => onAuthStateChanged(auth, callback);
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const sendVerification = (user) => sendEmailVerification(user);
// True once the user has opened their verification link. Then refreshes the sign-in token the rules check it in.
export async function checkVerified(user) {
  await user.reload();
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}
export const logOut = () => signOut(auth);

// Wipes the copy of the team's data this device keeps for offline use, so the next person to use it can't read it.
// Firebase can't be used again until the app restarts.
export async function clearDeviceData() {
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

// Makes sure the signed-in user is on the team. The owner creates the team on first sign-in;
// everyone else joins with the secret from their join code, which the security rules verify.
// Signing in by team number brings no secret, so only existing members get in that way.
// Joining needs the privacy policy accepted, even with an account that already exists.
// The team and its members are the same docs Inventory uses, so a member of either app is a member of both.
// Returns true when this call created the team.
export async function ensureMembership(user, connection, name, acceptedPrivacy) {
  const memberRef = doc(db, 'members', user.uid);
  if (await isMember(memberRef)) return false;
  if (!connection.secret) throw new Error(`You're not on ${connection.teamName}. Ask your team admin for the join code.`);
  if (!acceptedPrivacy) throw new Error(`Accept the privacy policy to join ${connection.teamName}.`);
  // New members confirm their email first, so a mistyped one can't be taken over later with Forgot password?.
  if (!user.emailVerified) throw Object.assign(new Error('Confirm your email to join.'), { code: 'unverified' });
  const created = connection.role === 'owner' && await createTeam(user, connection);
  await setDoc(memberRef, { email: user.email, name, secret: connection.secret, joinedAt: serverTimestamp() });
  return created;
}

async function createTeam(user, connection) {
  try {
    await setDoc(doc(db, 'team', 'info'), { name: connection.teamName, secret: connection.secret, owner: user.uid });
    return true;
  } catch (error) {
    // Already created on an earlier attempt, or from Inventory; joining below still checks the secret.
    if (error.code !== 'permission-denied') throw error;
    return false;
  }
}

async function isMember(memberRef) {
  try {
    return (await getDoc(memberRef)).exists();
  } catch (error) {
    if (error.code === 'permission-denied') return false;
    throw error;
  }
}

// False when the team's published rules are older than the ones this app was built with. Scout checks its own number
// (scoutRulesVersion in firestore.rules), so rules published from an older Inventory build, without Scout's section, show up here.
export async function rulesUpToDate() {
  try {
    await getDocFromServer(doc(db, 'scoutRulesVersion', String(__RULES_VERSION__)));
    return true;
  } catch (error) {
    if (error.code === 'permission-denied') return false;
    throw error;
  }
}

// True when the team's published rules let anyone in, like Firebase's "test mode" rules or rules that allow any signed-in
// user (anyone can make an account). No rule in firestore.rules matches rulesCheck/open, so reading it is only allowed then.
export async function rulesOpen() {
  try {
    await getDocFromServer(doc(db, 'rulesCheck', 'open'));
    return true;
  } catch (error) {
    if (error.code === 'permission-denied') return false;
    throw error;
  }
}

export async function getTeam() {
  return (await getDoc(doc(db, 'team', 'info'))).data();
}

// The key that lets the owner take the team off the developer's team list (see hub.js). Only the owner can read it.
export const saveOwnerKey = (ownerKey) => setDoc(doc(db, 'team', 'owner'), { ownerKey });

// Undefined until the team has been put on the list.
export const getOwnerKey = async () => (await getDoc(doc(db, 'team', 'owner'))).data()?.ownerKey;

// Public, so a short join code can find the team: holds no secret, only what the app needs to start Firebase.
export const setJoinInfo = ({ apiKey, authDomain, appId }, name) => setDoc(doc(db, 'join', 'info'), { apiKey, authDomain, appId, name });

export const watchMembers = (callback, onError) =>
  onSnapshot(collection(db, 'members'), (snap) => callback(snap.docs.map((d) => ({ uid: d.id, email: d.data().email, name: d.data().name }))), onError);

export const setMyName = (uid, name) => updateDoc(doc(db, 'members', uid), { name });

// ---------- routes ----------

export const watchRoutes = (callback, onError) =>
  onSnapshot(collection(db, 'scoutRoutes'), (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);

// Saves a route (a new one when id is null) and returns its id straight away, so saving works offline. The write
// finishes when the device is online, and reports a failure to onError.
export function saveRoute(id, route, onError) {
  const ref = id ? doc(db, 'scoutRoutes', id) : doc(collection(db, 'scoutRoutes'));
  setDoc(ref, { ...route, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() }).catch(onError);
  return ref.id;
}

export const deleteRoute = (id) => deleteDoc(doc(db, 'scoutRoutes', id));
