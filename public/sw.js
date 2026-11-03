// Shows the alerts the push relay sends (src/push.js, relay/worker.js), and opens the app when one is tapped.
self.addEventListener('push', (event) => {
  const { title, body } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, { body, icon: 'icon-192.png', tag: 'where-are-you' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then((windows) => windows[0]?.focus() ?? clients.openWindow(self.registration.scope)));
});
