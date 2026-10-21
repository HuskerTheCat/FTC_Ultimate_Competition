import QRCode from 'qrcode';
import * as firebase from './firebase.js';
import { parseFirebaseConfig, encodeJoinCode } from './joincode.js';
import { PROGRAMS } from './hub.js';
import { RULES, consolePage, AUTH_PAGE, RULES_PAGE, AUTH_OFF_CODES, setupProblems } from './setup.js';
import {
  loadConnection, forgetConnection, connectByCode, connectByNumber, connectNewTeam, connectExistingTeam,
  teamFromLink, connectFromLink, joinTeam,
} from './connection.js';
import { scanCode } from './scanner.js';
import { startStatusBanners, checkRules } from './status.js';
import season from './seasons/2027.js';
import { esc, icon, ICON_SCAN } from './ui.js';
import { routeFromLink } from './route.js';
import { startRoutes, renderRouteList, showRouteList, openSharedRoute, scanRoute } from './routes.js';
import { startScouting, renderScoutList, showMatchList } from './scouting.js';
import { startTeams, renderTeamList, showTeamList } from './teams.js';
import { startPits } from './pits.js';

const WEB_URL = 'https://huskerthecat.github.io/FTC_Ultimate_Scout/';
// Scout uses the same Firebase setup and the same account data as Inventory, so it shares Inventory's guides for now.
const PRIVACY_URL = 'https://huskerthecat.github.io/FTC_Ultimate_Inventory/privacy.html';
const SETUP_URL = 'https://huskerthecat.github.io/FTC_Ultimate_Inventory/setup.html';
const GUIDES_URL = 'https://huskerthecat.github.io/FTC_Ultimate_Inventory/guides.html';
const GUIDES_LINK = `<a class="guides-link" href="${GUIDES_URL}" target="_blank" rel="noopener">Guides</a>`;
// The AGPL license asks anyone hosting a version of the app to offer its source; forks should point this at their own code.
const SOURCE_URL = 'https://github.com/HuskerTheCat/FTC_Ultimate_Scout';
// Opening the app with ?demo runs it on sample data instead of a team's Firebase project (see demo.js).
const DEMO = new URLSearchParams(location.search).has('demo');
// The live website (main) stays locked until the app is ready: just the welcome page, with sign-in, setup and the demo
// turned off. Branch test sites are built unlocked (see .github/workflows/pages.yml).
const LOCKED = import.meta.env.VITE_LOCKED === 'true';
// Pain and suffering mode is the light theme. The choice is saved on this device only.
const THEME_KEY = 'ftc-scout-theme';
const THEME_COLORS = { light: '#eef1f7', dark: '#0e1221' };
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = THEME_COLORS[theme];
}
setTheme(localStorage.getItem(THEME_KEY) ?? 'dark');

const ICON_MENU = icon('<path d="M4 6h16M4 12h16M4 18h16"/>');

// The app's three parts, in tab order.
const TABS = [
  { id: 'routes', label: 'Routes', icon: icon('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>') },
  { id: 'scout', label: 'Scout', icon: icon('<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>') },
  { id: 'teams', label: 'Teams', icon: icon('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>') },
];
// The tab open last on this device.
const TAB_KEY = 'ftc-scout-tab';

let fb = firebase;
const app = document.getElementById('app');
const state = { connection: null, user: null, members: [], routes: [], matches: [], alliances: [], buttons: [], pits: [], robot: null, sharedRoute: null, tab: localStorage.getItem(TAB_KEY) ?? 'scout' };

// ---------- helpers ----------

// People are shown by their username; accounts made before usernames existed fall back to their email.
const nameOf = (member) => member?.name || member?.email.split('@')[0].slice(0, 40) || 'Someone';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/invalid-email': 'That email address isn’t valid.',
  'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Can’t reach the server. Check your internet connection.',
  // Firestore's code for something it can't do offline, like reading what this device hasn't stored yet.
  unavailable: 'That needs an internet connection. Try again once you’re back online.',
  // Usually a new version of the app that needs the new firestore.rules.
  'permission-denied': 'The server didn’t allow that change. If the app was just updated, ask your team admin to publish the latest rules.',
};

const ERROR_MS = 10000;
let errorTimer;

// Shows a message at the top for a few seconds, so it doesn't stay up after the problem is fixed.
function showError(error) {
  const message = ERROR_MESSAGES[error.code] ?? error.message.replace(/^Firebase: /, '').replace(/\s*\(.*\)\.?$/, '');
  const banner = document.getElementById('error');
  banner.textContent = message;
  if (error.link) banner.append(' ', Object.assign(document.createElement('a'), { href: error.link, target: '_blank', rel: 'noopener', textContent: error.linkText }));
  banner.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { banner.hidden = true; }, ERROR_MS);
}

// An error that links to where it can be fixed, like a page of the team's Firebase project.
const errorWithLink = (message, link, linkText) => Object.assign(new Error(message), { link, linkText });

// A button that copies `text` and says "Copied" for a moment.
function copyButton(button, text) {
  const label = button.textContent;
  button.onclick = () => navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = label; }, 1500);
  }).catch(showError);
}

// The ☰ menu opens from its button, and closes on a tap anywhere else or on Escape.
function showMenu(open) {
  const toggle = app.querySelector('#menu-toggle');
  if (!toggle) return;
  app.querySelector('#menu').hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menuwrap')) showMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') showMenu(false); });

// ---------- first screens ----------

// The team's program and number, as on the welcome screen's forms.
const teamFields = () => `
  <div class="teamid">
    <select name="program" aria-label="Program">${PROGRAMS.map((p) => `<option>${p}</option>`).join('')}</select>
    <input name="teamNumber" required inputmode="numeric" pattern="[1-9][0-9]{0,5}" placeholder="Team number, e.g. 12345" />
  </div>`;

// Shown while signing in and joining the team.
function renderLoading() {
  app.innerHTML = '<main class="center" aria-busy="true"></main>';
}

// The cube, which opens a menu of the FTC Ultimate apps (see wireAppSwitcher), on the welcome page and in the header.
const APP_SWITCHER = `
  <div class="menuwrap">
    <button id="apps-toggle" aria-label="FTC Ultimate apps" title="FTC Ultimate apps" aria-haspopup="true" aria-expanded="false" aria-controls="apps-menu"><span class="app-icon scout"></span></button>
    <div id="apps-menu" class="menu" hidden>
      <h3>FTC Ultimate</h3>
      <a class="menu-item" href="https://huskerthecat.github.io/FTC_Ultimate_Inventory/"><span class="app-icon inventory"></span>Inventory</a>
      <button class="menu-item" aria-current="true"><span class="app-icon scout"></span>Competition</button>
      <a class="menu-item" href="https://huskerthecat.github.io/FTC_Ultimate_Design/"><span class="app-icon design"></span>Design</a>
    </div>
  </div>`;

function renderWelcome() {
  app.innerHTML = `
    <main class="center wide">
      <div class="lockup">
        ${APP_SWITCHER}
        <h1 class="brand"><span>FTC Ultimate <span class="app-name">Competition</span></span></h1>
      </div>
      <p id="error" class="error" role="alert" hidden></p>
      <div class="card split">
        <form id="signin">
          <h2>Sign in to your team</h2>
          ${teamFields()}
          <button>Next</button>
        </form>
        <form id="join">
          <h2>New to the team? Enter your join code</h2>
          <input name="code" required autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Join code" />
          <div class="row">
            <button>Join team</button>
            <button type="button" id="scan-join" class="secondary">Scan QR</button>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Set up a new team</h2>
        <button id="setup" class="secondary">Start setup</button>
      </div>
      <div class="card">
        <h2>Just looking?</h2>
        <button id="demo" class="secondary">Try the demo</button>
      </div>
      ${GUIDES_LINK}
    </main>
    <dialog id="dialog"></dialog>`;

  app.querySelector('#demo').onclick = () => { location.search = 'demo'; };
  app.querySelector('#setup').onclick = renderSetup;
  app.querySelector('#signin').onsubmit = (e) => {
    e.preventDefault();
    const { program, teamNumber } = e.target;
    connectByNumber(program.value, Number(teamNumber.value)).catch(showError);
  };
  app.querySelector('#join').onsubmit = (e) => {
    e.preventDefault();
    connectByCode(e.target.code.value).catch(showError);
  };
  app.querySelector('#scan-join').onclick = () => scanCode(app.querySelector('#dialog'), 'Scan the join QR code', 'Point the camera at your team’s join QR code.')
    .then((text) => text && connectByCode(text))
    .catch(showError);
  wireAppSwitcher();
}

// The cube opens a menu of the FTC Ultimate apps, as in Inventory. Choosing one, a tap elsewhere or Escape closes it.
function wireAppSwitcher() {
  const toggle = app.querySelector('#apps-toggle');
  const menu = app.querySelector('#apps-menu');
  const show = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => show(menu.hidden);
  menu.onclick = (e) => e.target.closest('a, button') && show(false);
  document.addEventListener('pointerdown', (e) => e.target.closest('.menuwrap') || show(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && show(false));
}

function renderLocked() {
  renderWelcome();
  for (const control of app.querySelectorAll('.card :is(button, input, select)')) control.disabled = true;
}

// The setup steps in short, with the details in the setup guide. Creating the team first checks the Firebase project (see setup.js).
function renderSetup() {
  app.innerHTML = `
    <main class="center wide">
      <h1>Set up a new team</h1>
      <p id="error" class="error" role="alert" hidden></p>
      <div class="card">
        <ol class="steps">
          <li>Create a free project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a>.</li>
          <li>In Authentication, turn on <strong>Email/Password</strong> sign-in.</li>
          <li>Create a <strong>Firestore</strong> database in production mode. In its <strong>Rules</strong> tab, replace everything with the app’s rules and click <strong>Publish</strong>.
            <button type="button" id="copy-rules" class="secondary">Copy rules</button></li>
          <li>In Project settings, add a web app (<code>&lt;/&gt;</code>) and copy its <code>firebaseConfig</code>.</li>
        </ol>
      </div>
      <form id="create" class="card">
        <h2>Create your team</h2>
        <input name="teamName" required maxlength="200" placeholder="Team name, e.g. 12345 Example Team" />
        ${teamFields()}
        <textarea name="config" rows="6" required placeholder="Paste your firebaseConfig here"></textarea>
        <ul id="problems" class="problems" hidden></ul>
        <button>Create team</button>
      </form>
      <button id="back" class="link">Back</button>
      ${GUIDES_LINK}
    </main>`;

  copyButton(app.querySelector('#copy-rules'), RULES);
  app.querySelector('#back').onclick = renderWelcome;
  const form = app.querySelector('#create');
  const list = app.querySelector('#problems');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    button.textContent = 'Checking your Firebase project…';
    try {
      const config = parseFirebaseConfig(form.config.value);
      const problems = await setupProblems(config);
      list.hidden = !problems.length;
      list.innerHTML = problems.map(({ step, text, page, existingTeam }) => `<li>
        ${step ? `<strong>Step ${step}:</strong> ` : ''}${esc(text)}
        ${page ? `<a href="${esc(consolePage(config.projectId, page))}" target="_blank" rel="noopener">Fix it in Firebase</a>` : ''}
        ${existingTeam ? '<button type="button" id="signin-existing" class="link inline">Sign in to it</button>' : ''}
      </li>`).join('') + (problems.some((problem) => problem.step) ? '<li class="muted">Then click Create team again.</li>' : '');
      const program = form.program.value;
      const teamNumber = Number(form.teamNumber.value);
      const signInExisting = list.querySelector('#signin-existing');
      if (signInExisting) signInExisting.onclick = () => connectExistingTeam(config.projectId, program, teamNumber).catch(showError);
      if (!problems.length) connectNewTeam(config, form.teamName.value.trim(), program, teamNumber);
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
      button.textContent = 'Create team';
    }
  };
}

function renderSignIn() {
  const owner = state.connection.role === 'owner';
  // Signing in by team number brings no join code, so there's no account to create.
  const canJoin = Boolean(state.connection.secret);
  app.innerHTML = `
    <main class="center">
      <h1>${esc(state.connection.teamName)}</h1>
      <p class="muted">${!canJoin ? 'Sign in with your email and password.' : owner ? 'Create the admin account for your team.' : 'Sign in, or create an account if this is your first time.'}</p>
      <p id="error" class="error" role="alert" hidden></p>
      <form id="auth" class="card">
        ${canJoin ? '<input name="username" maxlength="40" autocomplete="nickname" placeholder="Your name (for new accounts)" />' : ''}
        <input name="email" type="email" required autocomplete="email" placeholder="Email" />
        <div class="password">
          <input name="password" type="password" required autocomplete="current-password" placeholder="Password" />
          <button type="button" id="toggle-password" class="secondary" aria-label="Show password">Show</button>
        </div>
        ${canJoin ? `<label class="check"><input name="privacy" type="checkbox" /><span>I accept the <a href="${PRIVACY_URL}" target="_blank" rel="noopener">privacy policy</a> (first time on this team)</span></label>` : ''}
        ${canJoin ? `<div class="row">
          <button name="action" value="up">Create account</button>
          <button name="action" value="in" class="secondary">Sign in</button>
        </div>` : '<button name="action" value="in">Sign in</button>'}
        <button type="button" id="reset" class="link">Forgot password?</button>
      </form>
      <button id="switch" class="link">Use a different team</button>
      ${GUIDES_LINK}
    </main>`;
  if (state.signInError) showError(state.signInError);
  state.signInError = null;

  const form = app.querySelector('#auth');
  app.querySelector('#toggle-password').onclick = (e) => {
    const hidden = form.password.type === 'password';
    form.password.type = hidden ? 'text' : 'password';
    e.target.textContent = hidden ? 'Hide' : 'Show';
    e.target.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const { username, email, password } = form;
    state.acceptedPrivacy = Boolean(form.privacy?.checked);
    try {
      if (e.submitter.value === 'up') {
        if (!username.value.trim()) throw new Error('Enter your name so teammates know who you are.');
        if (password.value.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (!form.privacy.checked) throw new Error('Accept the privacy policy to create an account.');
        state.newName = username.value.trim();
        const { user } = await fb.signUp(email.value, password.value);
        await fb.sendVerification(user);
      }
      else await fb.signIn(email.value, password.value);
    } catch (error) {
      showError(AUTH_OFF_CODES.includes(error.code)
        ? errorWithLink('Email sign-in isn’t turned on in this team’s Firebase project. The team admin needs to turn it on (setup step 2).',
          consolePage(state.connection.config.projectId, AUTH_PAGE), 'Open Authentication')
        : error);
    }
  };
  app.querySelector('#reset').onclick = async () => {
    if (!form.email.value) return showError(new Error('Enter your email first.'));
    try {
      await fb.resetPassword(form.email.value);
      showError(new Error('Password reset email sent.'));
    } catch (error) {
      showError(error);
    }
  };
  app.querySelector('#switch').onclick = forgetConnection;
}

const VERIFY_CHECK_MS = 3000;

// Shown to someone joining with an email they haven't confirmed yet. Members who already joined never see it.
// Checks every few seconds while the app is on screen, and moves on by itself once the link is opened.
function renderVerify(user, onVerified) {
  app.innerHTML = `
    <main id="verify" class="center">
      <h1>Check your email</h1>
      <p>We sent a link to <strong class="email">${esc(user.email)}</strong>. Open it to confirm it’s your email. This screen moves on by itself once you have.</p>
      <p class="muted">Not there? Check your spam or junk folder.</p>
      <p id="error" class="error" role="alert" hidden></p>
      <div class="card">
        <button id="resend" class="secondary">Send it again</button>
      </div>
      <button id="different" class="link">Use a different email</button>
      ${GUIDES_LINK}
    </main>`;
  let checking = false;
  const timer = setInterval(async () => {
    if (!app.querySelector('#verify')) return clearInterval(timer);
    if (document.hidden || checking) return;
    checking = true;
    try {
      if (await fb.checkVerified(user)) {
        clearInterval(timer);
        onVerified();
      }
    } catch (error) {
      showError(error);
    } finally {
      checking = false;
    }
  }, VERIFY_CHECK_MS);
  app.querySelector('#resend').onclick = async () => {
    try {
      await fb.sendVerification(user);
      showError(new Error(`Sent again to ${user.email}.`));
    } catch (error) {
      showError(error);
    }
  };
  app.querySelector('#different').onclick = () => fb.logOut();
}

// ---------- signed in ----------

// The header with the team's name and the ☰ menu, the tabs, and the open tab's page.
function renderApp() {
  const light = document.documentElement.dataset.theme === 'light';
  app.innerHTML = `
    <header>
      <div class="lockup">
        ${APP_SWITCHER}
        <h1 class="team-brand"><span class="team">${esc(state.connection.teamName)}</span> <span class="app-name">Competition</span></h1>
      </div>
      <div class="row">
        <button id="scan" class="secondary with-icon" aria-label="Scan a route QR code" title="Scan a route QR code">${ICON_SCAN}<span>Scan</span></button>
        <div class="menuwrap">
          <button id="menu-toggle" class="icon" aria-label="Menu" title="Menu" aria-haspopup="true" aria-expanded="false" aria-controls="menu">${ICON_MENU}</button>
          <div id="menu" class="menu" hidden>
            <button id="team" class="menu-item">Team</button>
            <button id="theme" class="menu-item" role="switch" aria-checked="${light}">Pain and suffering mode<span class="switch" aria-hidden="true"></span></button>
            <button id="signout" class="menu-item">Sign out</button>
            <p class="menu-version">Version ${esc(__APP_VERSION__)}</p>
          </div>
        </div>
      </div>
    </header>
    <nav class="tabs" aria-label="Sections">
      ${TABS.map((tab) => `<button data-tab="${tab.id}">${tab.icon}<span>${tab.label}</span></button>`).join('')}
    </nav>
    <p id="error" class="error" role="alert" hidden></p>
    <main id="page" class="page"></main>
    <dialog id="dialog"></dialog>`;

  // An error belongs to the screen it happened on, so a new screen clears it.
  new MutationObserver(() => { app.querySelector('#error').hidden = true; }).observe(app.querySelector('#page'), { childList: true });
  app.querySelector('#menu-toggle').onclick = () => showMenu(app.querySelector('#menu').hidden);
  // Scan reads another team's route QR code from any tab; the route opens in Routes.
  app.querySelector('#scan').onclick = scanRoute;
  wireAppSwitcher();
  app.querySelector('#team').onclick = () => {
    showMenu(false);
    openTeamDialog().catch(showError);
  };
  app.querySelector('#theme').onclick = (e) => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    setTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    e.currentTarget.setAttribute('aria-checked', String(theme === 'light'));
  };
  app.querySelector('#signout').onclick = () => fb.logOut();
  app.querySelector('.tabs').onclick = (e) => {
    const button = e.target.closest('[data-tab]');
    if (!button) return;
    state.tab = button.dataset.tab;
    localStorage.setItem(TAB_KEY, state.tab);
    scrollTo(0, 0);
    renderTab();
  };
  renderTab();
}

function renderTab() {
  for (const button of app.querySelectorAll('[data-tab]')) {
    if (button.dataset.tab === state.tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  ({ routes: renderRouteList, scout: renderScoutList, teams: renderTeamList })[state.tab]();
}

// Opens a shared route's link in the Routes tab.
function showSharedRoute(route) {
  state.tab = 'routes';
  renderTab();
  openSharedRoute(route, true);
}

// The join code is built from the team's current secret, so it stays valid after the owner resets it in Inventory.
async function openTeamDialog() {
  const dialog = app.querySelector('#dialog');
  const team = await fb.getTeam();
  const code = encodeJoinCode({ projectId: state.connection.config.projectId, secret: team.secret });
  const link = `${WEB_URL}#join=${code}`;
  const me = state.members.find((m) => m.uid === state.user.uid) ?? { email: state.user.email };
  dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>Invite teammates</h2>
      <canvas id="qr"></canvas>
      <div class="field">Join code
        <div class="password">
          <input readonly value="${esc(code)}" aria-label="Join code" />
          <button type="button" id="copy-code" class="secondary">Copy</button>
        </div>
      </div>
      <button type="button" id="copy-link">Copy join link</button>
      <p class="muted small">Only share these with your team. Anyone with them can join. They work in every FTC Ultimate app.</p>
      <h2>Your name</h2>
      <div class="password">
        <input id="my-name" maxlength="40" value="${esc(nameOf(me))}" aria-label="Your name" />
        <button type="button" id="save-name" class="secondary">Save</button>
      </div>
      <h2>Members</h2>
      <ul class="members">${[...state.members].sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map((m) => `
        <li>
          <span><strong>${esc(nameOf(m))}</strong> <span class="muted small">${esc(m.email)}</span></span>
          ${m.uid === team.owner ? '<span class="muted small">Owner</span>' : ''}
        </li>`).join('')}
      </ul>
      <p class="muted small">FTC Ultimate Competition is open source under the AGPL v3. <a href="${SOURCE_URL}" target="_blank" rel="noopener">Source code</a></p>
      <div class="row"><button value="close" class="secondary">Close</button></div>
    </form>`;
  copyButton(dialog.querySelector('#copy-link'), link);
  copyButton(dialog.querySelector('#copy-code'), code);
  await QRCode.toCanvas(dialog.querySelector('#qr'), link, { width: 220, margin: 1 });
  dialog.querySelector('#save-name').onclick = () => {
    const name = dialog.querySelector('#my-name').value.trim();
    if (!name) return showError(new Error('Your name can’t be empty.'));
    fb.setMyName(state.user.uid, name).then(() => dialog.close()).catch(showError);
  };
  dialog.showModal();
}

// How the team admin publishes the app's rules. `open` when the published rules let anyone in.
function openRulesDialog(open) {
  const dialog = app.querySelector('#dialog');
  dialog.innerHTML = `
    <form method="dialog" class="card">
      <h2>${open ? 'Fix your Firebase rules' : 'Update your Firebase rules'}</h2>
      <p class="muted">${open
        ? 'Your team’s Firebase project isn’t using the app’s rules, so anyone could read your team’s data and your members’ emails.'
        : 'This version of the app needs newer rules. New features won’t work until they’re published.'}
        Only your team admin, the person who owns the team’s Firebase project, can do this. It doesn’t change any of your team’s data.</p>
      <ol class="steps">
        <li><button type="button" id="copy-rules" class="secondary">Copy rules</button></li>
        <li><a href="${esc(consolePage(state.connection.config.projectId, RULES_PAGE))}" target="_blank" rel="noopener">Open your Firebase rules</a>, signed in with the Google account that owns the project.</li>
        <li>Select everything in the rules editor, paste the rules over it and click <strong>Publish</strong>.</li>
        <li>Wait a minute, then reopen the app.</li>
      </ol>
      <div class="row"><button value="close" class="secondary">Close</button></div>
    </form>`;
  copyButton(dialog.querySelector('#copy-rules'), RULES);
  dialog.showModal();
}

// A route link opened by someone who isn't signed in: the route plays on its own, with a way into the app.
function renderSharedRoute(route) {
  app.innerHTML = `
    <header><h1 class="brand">FTC Ultimate <span class="app-name">Competition</span></h1><a href="./" class="link">Open the app</a></header>
    <p id="error" class="error" role="alert" hidden></p>
    <main id="page" class="page"></main>
    <dialog id="dialog"></dialog>`;
  openSharedRoute(route, false);
}

// ---------- startup ----------

// A join link opened the app: switch to its team, asking first when this device is on another team.
async function joinFromLink() {
  const joining = await teamFromLink();
  if (!joining) return;
  if (state.connection && state.connection.config.projectId !== joining.config.projectId
    && !confirm(`Switch from ${state.connection.teamName} to ${joining.teamName}?`)) return;
  connectFromLink(state.connection, joining);
}

async function start() {
  if (LOCKED) return renderLocked();
  try {
    state.sharedRoute = routeFromLink();
  } catch (error) {
    alert(error.message);
  }
  if (DEMO) {
    fb = await import('./demo.js');
    state.connection = { teamName: '12345 Example Team', config: { projectId: 'demo' } };
    document.getElementById('demo-banner').hidden = false;
  } else {
    state.connection = loadConnection();
    try {
      await joinFromLink();
    } catch (error) {
      alert(error.message);
    }
    if (!state.connection) return state.sharedRoute ? renderSharedRoute(state.sharedRoute) : renderWelcome();
  }

  fb.connect(state.connection.config);
  renderLoading();
  let stopWatching = () => {};
  const enterTeam = async (user) => {
    stopWatching();
    state.user = null;
    if (!user) return renderSignIn();
    // The demo member is already on the demo team.
    if (!DEMO) {
      try {
        await joinTeam(user, state.connection, state.newName || nameOf({ email: user.email }), state.acceptedPrivacy, showError);
        state.newName = null;
      } catch (error) {
        if (error.code === 'unverified') return renderVerify(user, () => enterTeam(user));
        const creating = state.connection.role === 'owner' && state.connection.secret;
        state.signInError = error.code !== 'permission-denied' ? error
          // The owner's first sign-in creates the team, which only the app's rules allow.
          : creating ? errorWithLink('Your Firebase project doesn’t have the app’s rules yet (setup step 3). Publish them, then sign in.',
            `${SETUP_URL}#3-create-the-database`, 'Show me how')
            : new Error(`Couldn't join ${state.connection.teamName}. Ask your team admin for a fresh join code.`);
        await fb.logOut();
        return;
      }
    }
    state.user = user;
    renderApp();
    if (state.sharedRoute) showSharedRoute(state.sharedRoute);
    state.sharedRoute = null;
    checkRules(fb, openRulesDialog).catch(showError);
    const onError = (error) => {
      if (error.code !== 'permission-denied') return showError(error);
      state.signInError = new Error(`You no longer have access to ${state.connection.teamName}.`);
      fb.logOut();
    };
    const stops = [
      fb.watchMembers((members) => { state.members = members; }, onError),
      fb.watchRoutes((routes) => {
        state.routes = routes;
        // The list follows teammates' changes; an open editor or player is left alone.
        if (app.querySelector('#route-list')) showRouteList();
      }, onError),
      fb.watchMatches((matches) => {
        state.matches = matches;
        // Lists follow teammates' scouting; counters and team pages are left alone.
        if (app.querySelector('#match-list')) showMatchList();
        if (app.querySelector('#team-list')) showTeamList();
      }, onError),
      fb.watchAlliances((alliances) => {
        state.alliances = alliances;
        if (app.querySelector('#match-list')) showMatchList();
        if (app.querySelector('#team-list')) showTeamList();
      }, onError),
      fb.watchButtons((buttons) => { state.buttons = buttons; }, onError),
      fb.watchRobot((robot) => { state.robot = robot; }, onError),
      fb.watchPits((pits) => {
        state.pits = pits;
        if (app.querySelector('#team-list')) showTeamList();
      }, onError),
    ];
    stopWatching = () => stops.forEach((stop) => stop());
  };
  fb.watchUser(enterTeam);
}

// A route scanned or opened while the app is running.
addEventListener('hashchange', () => {
  if (!state.user) return;
  try {
    const route = routeFromLink();
    if (route) showSharedRoute(route);
  } catch (error) {
    showError(error);
  }
});

// What each tab needs from the app.
const tabContext = {
  get page() { return app.querySelector('#page'); },
  showTab(tab) {
    state.tab = tab;
    localStorage.setItem(TAB_KEY, tab);
    scrollTo(0, 0);
    renderTab();
  },
  get dialog() { return app.querySelector('#dialog'); },
  get fb() { return fb; },
  state,
  showError,
};
startRoutes(tabContext);
startScouting(tabContext);
startTeams(tabContext);
startPits(tabContext);
startStatusBanners();
start();
