# Session Replay for Zapier

A Zapier Platform CLI integration whose triggers are the signed webhooks Session Replay
already sends. There is no second delivery path here: a Zap's webhook URL is an ordinary
webhook destination, and every event arrives as the same signed `POST` any other endpoint
would receive.

## Layout

```
zapier/
  index.js     what gets pushed - the app plus its version numbers
  app.js       the definition itself, with no dependency on the platform packages
  lib/         the event names, signature checking, subscribing, and the payload mapping
  triggers/    one trigger per event
  test/        node --test, no install required
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

If the header is not readable, `id` falls back to the event, the report id and `sent_at`
together, which keeps both of those properties: `sent_at` is stored with the delivery when
it is queued, so every retry of one delivery repeats it and two separate deliveries never
share it. A delivery carrying neither the header nor a `sent_at` is refused, because any id
that could be built from what is left would collapse a report's whole history into one
event.

## Setting up a Zap

One way. Add a Session Replay trigger, pick the event, and paste a token from **Settings**
into its **API token** field. Turning the Zap on registers its own webhook URL as a webhook
destination subscribed to that one event; turning the Zap off removes that destination again.

The token is required, and deliberately so. Registering is the only thing that gives Session
Replay somewhere to send to, and there is no webhook URL to copy out of Zapier and paste in
by hand: a trigger that defines subscribe and unsubscribe is a REST hook, and Zapier hands
the URL to `performSubscribe` rather than showing it. A Zap turned on without a token would
therefore be subscribed to nothing and would sit there receiving nothing, so turning it on
without one fails instead, with a message saying where to get a token.

There is still no account connection to make. The token is a field on the trigger, used at
the moment the Zap is turned on and off, not a credential Zapier holds for the account.

Fill in **Webhook signing key** as well. Subscribing hands the key back with the destination
and the Zap keeps it, but a pasted key is the only one the Zap is certain to be holding when
a delivery arrives, and without a key it accepts anything posted to its URL. To read the key
once the Zap has registered itself, open that destination under **Connectors**, rotate its
secret, and copy what the screen shows.

Given a key, every incoming request is checked against the `X-Session-Replay-Signature`
header - HMAC-SHA256 over `<unix timestamp>.<raw body>`, with the timestamp inside the signed
material and a five minute tolerance, which is exactly what the sending side does.

The key belongs to one webhook destination rather than to an account, which is why it lives
on the trigger. Every Zap has its own webhook URL, so every Zap is its own destination with
its own secret, and rotating that secret on the Connectors screen stops that one Zap until
the new key is pasted in. A pasted key wins over the one subscribing stored, so rotating is
still the way out.

## Why there is no account connection

An earlier draft asked for an API token from **Settings** and used it to fetch recent
reports for the test step. That token is a JWT with a fixed lifetime - one day, as the app
is configured - and there is no refresh the integration can drive, because refresh tokens
are single-use and mint a replacement session, which Zapier has nowhere to put. The token
would have worked on the day it was pasted and returned `401` from then on.

Deliveries arrive by push, so a connection would have existed only to fill the test step,
which now answers from the samples instead. The one call the integration does make is
subscribing, and that is a single request at the moment the token is pasted rather than a
credential Zapier has to keep working - see below.

## Subscribing, and what a day-long token costs

`performSubscribe` posts `{url: <the Zap's webhook URL>, events: [<the trigger's event>]}` to
`/api/v1/webhook_destinations` and keeps the `id` and the signing key that come back;
`performUnsubscribe` deletes that id. Nothing else changed to make that work, because the
delivery it subscribes to is already the one these triggers read.

An API token is a JWT whose lifetime is a day, and there is no refresh the integration can
drive, so a token pasted today is refused tomorrow. Subscribing happens seconds after it is
pasted and works. Unsubscribing happens whenever the Zap is turned off, which may be much
later, and will be refused then: the destination survives and has to be removed on the
Connectors screen. Turning that Zap on again with a fresh token registers a second
destination rather than reclaiming the first, so a Zap switched on and off over a long life
leaves destinations behind to be tidied up there.

What removes that gap is OAuth rather than a longer token. Zapier persists rotated tokens,
and the site already serves the authorization code and refresh token grants, but the
`client_id` has to resolve to a metadata document declaring Zapier's redirect URI, and that
URI is only known once the integration is registered. So this is the shape to revisit
immediately after registering, not before.

## Testing a trigger before an event has happened

`performList` answers Zapier's "test trigger" step with the trigger's own sample, so the
step works before the first delivery and without a network call.

## Running the tests

```
npm test
```

No install is needed - the tests import the app definition directly and stub `bundle`. With
`zapier-platform-core` installed, one further test runs the platform's own validator against
what `zapier push` would upload; without it, that test skips and says so.

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
`npx zapier-platform validate` lists both. Expect a warning about the app declaring no
authentication - that is the decision above, and `zapier-platform push --skip-validation`
gets past it if it ever hardens into an error. The schema calls authentication an
expectation of a public app, so directory review is where it has to be argued rather than
the push.

Submitting the integration for directory review is a separate step, done in the Zapier
console rather than from the command line.
