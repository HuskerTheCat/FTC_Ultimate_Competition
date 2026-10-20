// Banners above the app: one while offline, and one when the team's published rules are old or let anyone in.
const offlineBanner = document.getElementById('offline-banner');
const rulesBanner = document.getElementById('rules-banner');
const openRulesBanner = document.getElementById('open-rules-banner');

function showOffline() {
  offlineBanner.hidden = navigator.onLine;
}

// Checked once per sign-in. Only the team owner can publish new rules, so the banners open the steps to send them.
export async function checkRules(fb, openRulesDialog) {
  if (!navigator.onLine) return addEventListener('online', () => checkRules(fb, openRulesDialog), { once: true });
  rulesBanner.onclick = () => openRulesDialog(false);
  openRulesBanner.onclick = () => openRulesDialog(true);
  openRulesBanner.hidden = !(await fb.rulesOpen());
  rulesBanner.hidden = !openRulesBanner.hidden || await fb.rulesUpToDate();
}

export function startStatusBanners() {
  showOffline();
  addEventListener('online', showOffline);
  addEventListener('offline', showOffline);
}
