# Push relay

Sends "<name> asked where you are" to a teammate's phone from the Find tab. The website can't send a push itself, because
sending needs a private key, so this small Cloudflare Worker does it. It stores nothing and only sends that one message.
One relay serves every team. `src/push.js` holds its address and public key.

## Setting it up (once)

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Open **Workers & Pages**, click **Create**, start from **Hello World**, name it `ftc-ultimate-push` and click **Deploy**.
3. Click **Edit code**, replace everything with [worker.js](worker.js) and click **Deploy**.
4. In the Worker's **Settings**, under **Variables and Secrets**, add a **Secret** named `VAPID_PRIVATE_KEY`. Its value is
   the private key (a line of JSON) that goes with `VAPID_PUBLIC_KEY` in `src/push.js`. Never put it in this repo.
5. Put the Worker's address (`https://ftc-ultimate-push.<your-name>.workers.dev`) in `RELAY_URL` in `src/push.js`.

A new key pair means a new `VAPID_PUBLIC_KEY` in `src/push.js` and a new secret here, and everyone turns alerts on again.
