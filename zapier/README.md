# Session Replay for Zapier

A Zapier Platform CLI integration whose triggers are the signed webhooks Session Replay
already sends. There is no second delivery path here: a Zap's webhook URL is an ordinary
webhook destination, and every event arrives as the same signed `POST` any other endpoint
would receive.

## Layout

```
zapier/
  index.js          what gets pushed - the app plus its version numbers
  app.js            the definition itself, with no dependency on the platform packages
  authentication.js the API token and the optional signing key
  lib/              the event names, signature checking, and the payload mapping
  triggers/         one trigger per event
  test/             node --test, no install required
```

`app.js` is deliberately separate from `index.js`. Only `index.js` reaches for
`zapier-platform-core`, so everything with logic in it can be tested with nothing installed.

## The events

Five triggers, one per name in the app's `WebhookEvent` vocabulary:

| Trigger | Event | Fires when |
| --- | --- | --- |
| New Bug Report | `report.created` | a new report arrives for one of your domains |
| Report Status Changed | `report.status_changed` | somebody moves a report to a different status |
| Report Severity Changed | `report.severity_changed` | somebody changes how severe a report is |
| Report First Viewed | `report.first_viewed` | a report is opened for the first time |
| Report Sent | `report.sent` | somebody sends a report to this webhook by hand |

A destination subscribes to whichever of these it wants, and one webhook URL may carry
several. Each trigger therefore ignores deliveries for the other events rather than assuming
its URL only ever receives its own.

## What a trigger returns

The payload's `data` is hoisted so the fields are one level from the top, which is what
Zapier's field picker wants:

```json
{
  "id": "the delivery id",
  "event": "report.created",
  "version": 1,
  "sent_at": "2026-09-05T11:42:07Z",
  "report": {
    "id": "...", "share_token": "...", "share_url": "...",
    "status": "pending", "severity": "major",
    "created_at": "...", "updated_at": "..."
  },
  "site": { "id": "...", "domain": "example.com" }
}
```

`id` is the delivery id from the `X-Session-Replay-Delivery` header, not the report id.
That is what makes deduplication correct in both directions: a retried delivery keeps its
id and fires once, while two status changes to the same report are two deliveries and fire
twice.

## Setting up a Zap

1. In Zapier, add a Session Replay trigger and copy the webhook URL it gives you.
2. In Session Replay, go to **Connectors**, add a webhook destination, paste that URL, and
   tick the events you want.
3. Copy the signing key shown once on that screen, and paste it into the Zapier connection.

Step 3 is optional. Given the key, every incoming request is checked against the
`X-Session-Replay-Signature` header - HMAC-SHA256 over `<unix timestamp>.<raw body>`, with
the timestamp inside the signed material and a five minute tolerance, which is exactly what
the sending side does. Without it, the Zap accepts anything posted to its URL.

## Why the URL is pasted by hand

Zapier prefers REST Hooks, where `performSubscribe` creates the destination over the API and
`performUnsubscribe` removes it. Session Replay has no API for webhook destinations today -
they exist only on the Connectors screen - so the app ships as a static webhook, which the
platform schema accepts. Adding `performSubscribe` and `performUnsubscribe` later is a small
addition to `lib/hook.js` once that endpoint exists; nothing else here changes, because the
delivery it subscribes to is already the one these triggers read.

## Testing a trigger before an event has happened

`performList` answers Zapier's "test trigger" step from `GET /api/v1/replays`, using the API
token on the connection, and maps the result into the same shape a delivery produces. One
field cannot be filled from there: the list endpoint does not serve severity, so
`report.severity` is `null` in test data and carries a real value in live deliveries.

## Running the tests

```
npm test
```

No install is needed - the tests import the app definition directly and stub `z` and
`bundle`. With `zapier-platform-core` installed, one further test runs the platform's own
validator against what `zapier push` would upload; without it, that test skips and says so.

## Pushing it

Needs a Zapier developer account, which is why it is not done from here. The CLI's binary is
`zapier-platform`, and registering comes before pushing: `push` builds and uploads against
the integration named in `.zapierapprc`, and that file is what `register` creates.

```
cd integration/zapier
npm install
npx zapier-platform login
npx zapier-platform register
npx zapier-platform validate
npx zapier-platform push
```

`login` asks for the Zapier account email and password, and a one-time code if the account
has two-factor turned on; it writes a deploy key to `~/.zapierrc`. An account that signs in
through Google or another single sign-on button has no password - use
`npx zapier-platform login --sso` and paste a deploy key from the Zapier dashboard instead.

`register` asks for the integration's title, a one-sentence description, a homepage URL, the
audience (start private - it can be made public when it is submitted), your role in relation
to Session Replay, a category, and whether to subscribe to platform email. It writes
`.zapierapprc`, which is git-ignored here because it names one account's integration.

`push` then validates and uploads. Style warnings do not stop it; only style errors do, and
`npx zapier-platform validate` lists both. Expect a warning about the triggers having no
`performSubscribe` - that is the static webhook decision above, and `--skip-validation` will
bypass the check entirely if it ever hardens into an error.

Submitting the integration for directory review is a separate step, done in the Zapier
console rather than from the command line.
