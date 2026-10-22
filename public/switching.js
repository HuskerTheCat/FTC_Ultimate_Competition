// Opening another FTC Ultimate app on the website (src/switching.js) covers the page with that app's loading screen,
// #switching in index.html. The app it opens shows the same screen from its first paint until it has drawn its first screen,
// then fades it out. A plain script in <head>, so it runs before anything is shown.
if (sessionStorage.getItem('ftc-ultimate-switching')) {
  sessionStorage.removeItem('ftc-ultimate-switching');
  document.documentElement.classList.add('switching');
  const drawn = new MutationObserver(() => {
    if (!document.getElementById('app')?.firstElementChild) return;
    drawn.disconnect();
    document.documentElement.classList.remove('switching');
  });
  drawn.observe(document.documentElement, { childList: true, subtree: true });
}
// Coming back with the browser's Back button, the page is still covered by the loading screen.
addEventListener('pageshow', (e) => e.persisted && document.documentElement.classList.remove('switching'));
