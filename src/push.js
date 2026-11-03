// Alerts on a teammate's phone when someone asks where they are (Find tab), sent through the push relay (relay/worker.js),
// since the website can't send a push itself. public/sw.js shows them.
const RELAY_URL = 'RELAY_URL_PENDING';
// The relay's public VAPID key; its private key is a secret in the relay (relay/README.md).
const VAPID_PUBLIC_KEY = 'BPC0gXoLNxdagEuuku_Q3X6riTQc8dz51AlRBt9pJxlzdUBzuIKVkZ1JeTW-ahLg_M1Oq2TtH0VcrFC9NE2aTyA';

// iPhones only get alerts once the app is added to the Home Screen and opened from there.
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window;

export function registerWorker() {
  if (pushSupported()) navigator.serviceWorker.register('sw.js');
}

// This device's push address, or undefined when alerts aren't on here.
export async function deviceEndpoint() {
  const registration = await navigator.serviceWorker.ready;
  return Notification.permission === 'granted' ? (await registration.pushManager.getSubscription())?.endpoint : undefined;
}

// Asks for permission, and returns this device's subscription for the member's scoutPushSubs doc.
export async function subscribe() {
  if (await Notification.requestPermission() !== 'granted') throw new Error('Alerts are blocked. Allow notifications for this app in your browser or phone settings.');
  const registration = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const { endpoint, keys } = (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })).toJSON();
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

// Alerts each subscription that `from` asked where they are. 404 and 410 mean that teammate turned alerts off there.
export function sendAlerts(subs, from, onError) {
  for (const { endpoint, p256dh, auth } of subs) {
    fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: { endpoint, keys: { p256dh, auth } }, from }),
    }).then((response) => {
      if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Couldn’t send the alert (relay answered ${response.status}).`);
    }).catch(onError);
  }
}
