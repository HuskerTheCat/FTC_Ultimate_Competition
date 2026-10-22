// Opening another FTC Ultimate app on the website: this page fades into that app's loading screen (#switching in index.html),
// then opens the app, which keeps the same screen up until it is ready (public/switching.js). Browsers with view transitions
// also cross-fade the two pages (style.css). The same file is in Inventory, Competition and Design.
let prefetched = false;

// When the app menu opens: fetch the other apps' pages and loading cubes, so a switch is quick.
export function prefetchApps(menu) {
  if (prefetched) return;
  prefetched = true;
  for (const link of menu.querySelectorAll('a[data-app]')) {
    for (const href of [link.href, new URL('loading.svg', link.href).href]) {
      document.head.append(Object.assign(document.createElement('link'), { rel: 'prefetch', href }));
    }
  }
}

// Shows the loading screen of the app `link` opens, then opens it.
export async function openApp(link) {
  const screen = document.getElementById('switching');
  screen.dataset.app = link.dataset.app;
  screen.querySelector('img').src = new URL('loading.svg', link.href).href;
  screen.querySelector('.app-name').textContent = link.textContent.trim();
  document.documentElement.classList.add('switching');
  await Promise.all(screen.getAnimations().map((fade) => fade.finished));
  sessionStorage.setItem('ftc-ultimate-switching', '1');
  location.href = link.href;
}
