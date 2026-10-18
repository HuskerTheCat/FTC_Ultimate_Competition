// The welcome screen, copied from Inventory. Not wired up yet: the buttons do nothing until Scout's Firebase code is in.
const GUIDES_URL = 'https://huskerthecat.github.io/FTC_Ultimate_Inventory/guides.html';
const PROGRAMS = ['FTC', 'FRC', 'FLL', 'Other'];

const app = document.querySelector('#app');

function renderWelcome() {
  app.innerHTML = `
    <main class="center wide">
      <h1 class="brand"><span>FTC Ultimate <span class="app-name">Scout</span></span></h1>
      <div class="card split">
        <form id="signin">
          <h2>Sign in to your team</h2>
          <div class="teamid">
            <select name="program" aria-label="Program">${PROGRAMS.map((p) => `<option>${p}</option>`).join('')}</select>
            <input name="teamNumber" required inputmode="numeric" pattern="[1-9][0-9]{0,5}" placeholder="Team number, e.g. 12345" />
          </div>
          <button>Next</button>
        </form>
        <form id="join">
          <h2>New to the team? Enter your join code</h2>
          <input name="code" required autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Join code" />
          <div class="row">
            <button>Join team</button>
            <button type="button" class="secondary">Scan QR</button>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>Set up a new team</h2>
        <button class="secondary">Start setup</button>
      </div>
      <div class="card">
        <h2>Just looking?</h2>
        <button class="secondary">Try the demo</button>
      </div>
      <a class="guides-link" href="${GUIDES_URL}" target="_blank" rel="noopener">Guides</a>
    </main>`;
  for (const form of app.querySelectorAll('form')) form.onsubmit = (e) => e.preventDefault();
}

renderWelcome();
