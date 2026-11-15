// Banners above the app: the development note until it's closed, one while offline, and one when the team's published
// rules are old or let anyone in.
const devBanner = document.getElementById('dev-banner');
// Closing the development note hides it for good on this device.
const DEV_BANNER_KEY = 'ftc-scout-dev-banner-closed';
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
  devBanner.hidden = localStorage.getItem(DEV_BANNER_KEY) === 'true';
  document.getElementById('dev-banner-close').onclick = () => {
    localStorage.setItem(DEV_BANNER_KEY, 'true');
    devBanner.hidden = true;
  };
  showOffline();
  addEventListener('online', showOffline);
  addEventListener('offline', showOffline);
}
