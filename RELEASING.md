# Releasing

A release is a tag. The tag is somebody saying "this is that version" rather than a side
effect of a merge.

The publish itself is done **by hand**. The npm account has two-factor authentication on it
and a one-time code cannot be given to a workflow; an automation token would get around
that, and the account is worth more than the saved minute. So the tag follows the publish
rather than causing it.

```sh
# 1. decide the version, point the README's pinned URLs and LIBRARY_VERSION in
#    src/beacon.js at it, and commit that - npm version wants a clean tree
npm version minor          # or patch / major - commits and tags in one step

# 2. make sure the file sites load matches the source
npm run build && git diff --exit-code dist/

# 3. publish, from master, with nothing uncommitted. npm asks for the one-time code:
npm publish --access public

# 4. push the commit and the tag
git push origin master --follow-tags
```

The README's install snippets pin the version in the filename, so they document whatever
version they name rather than the one being released. The suite fails while a pin and
`package.json` disagree, which is what stops a new function being documented under a pin
published before it existed.

`LIBRARY_VERSION` in `src/beacon.js` is the version the beacon reports, and the suite fails
while it and `package.json` disagree. It is held in the source rather than read from
`package.json` because the script-tag build is a concatenation of the source files and a
browser cannot read the manifest.

`--access public` because the package is scoped, and scoped packages are private by default
- which would fail rather than publish something unintended.

The tag starts the release workflow. It does not publish: it runs the tests, checks that the
tag and `package.json` agree, checks `dist/` is in step with `src/`, checks that the version
the tag names is the one the registry is actually serving and that the published files match
what the tag points at, and then cuts a GitHub release with generated notes. A red run means
the tag and the published package disagree, which is worth knowing.

## Copying the release to the site

Publishing to npm does not reach anybody who installed with a `<script>` tag. Those pages
load the library from session-replay.com, out of the site repository's
`public/integration/`, so every release also needs a site pull request that does three
things:

1. **Add the versioned files.** Copy `dist/session-replay.js` and `dist/session-replay.css`
   to `public/integration/session-replay-<version>.js` and `.css`. They are never edited or
   removed afterwards: the site has handed out URLs with the version in the filename, and
   nginx serves them as `public, immutable` with a far-future expiry.
2. **Overwrite the latest files with the same bytes.** Copy the same two files over
   `public/integration/session-replay-latest.js` and `session-replay-latest.css`.
   `spec/models/integration_script_spec.rb` fails while the latest files differ from the
   versioned files for `IntegrationScript::VERSION`, so the two cannot drift apart.
3. **Bump `IntegrationScript::VERSION`** in `app/models/integration_script.rb`.
   `IntegrationScript.path` / `url` and `stylesheet_path` / `stylesheet_url` build the pinned
   URLs from it; `latest_path` / `latest_url` and `latest_stylesheet_path` /
   `latest_stylesheet_url` name the latest files, which carry no version.

```sh
v=0.5.0
cp dist/session-replay.js  ../site/public/integration/session-replay-$v.js
cp dist/session-replay.css ../site/public/integration/session-replay-$v.css
cp dist/session-replay.js  ../site/public/integration/session-replay-latest.js
cp dist/session-replay.css ../site/public/integration/session-replay-latest.css
# then set VERSION = "0.5.0" in app/models/integration_script.rb
```

The beacon reports `LIBRARY_VERSION`, which is compiled into the build, so a page loading
the latest file still reports the real version number rather than "latest".

### A release on latest is a deploy to every customer

The latest files update every existing embed that uses them: a page loading
`session-replay-latest.js` picks up a new release on its next load, without its owner doing
anything. That makes every release that overwrites the latest files a deploy to **all** of
those customers at once, on sites we do not control and cannot test.

So the embed contract has to stay backward-compatible across every release served on
latest: the `<script>` and `<link>` tags as the install snippet gives them, what
`data-sr-trigger` does, `window.SessionReplay` and the functions on it, and the events
exchanged with the extension. A page written against any earlier release on latest has to
keep working unchanged. A change that cannot be made that way does not go on latest.

There is deliberately no major-pinned alias (`session-replay-v0.js` and the like) to absorb
a breaking change; one was considered and decided against, and this discipline replaces
it. The version number protects nobody on latest: a major bump there still lands on every
page that loads it.

### Latest is not recommended to customers yet

The latest files are on the site, but the install snippet and the docs still give the
pinned URL, and nothing should point a customer at latest until the servers are ready.

The site's `config/deploy/templates/nginx.conf.template` has a location for
`/integration/session-replay-latest.*` that sends `Cache-Control: public, no-cache`, but an
ordinary deploy does not rewrite the server's nginx config. Until that rule has been applied
on staging and production, the latest files are served like everything else under
`/integration/`: `public, immutable` with a far-future expiry. A page that loaded latest in
that window would keep its first copy in visitors' browsers for years, out of reach of any
later release. The snippet change that recommends latest waits until the rule is applied
and the headers are checked on both servers.

## Versioning

Semver, read from the point of view of a site that has already installed it.

- **patch** — a fix nobody has to know about
- **minor** — something new that changes nothing existing: a new export, a new option
- **major** — anything that could stop an existing page working, including a change to
  what `data-sr-trigger` does or to the shape of what `report()` returns

The overlay's wording is not part of the API and can change in a patch. The events it
exchanges with the extension **are**: the extension and this library have to keep agreeing,
so a change to `sessionreplay:ping` or `sessionreplay:open-panel` is a major here and needs
an extension release beside it.

## Published versions

`npm publish` cannot be undone after 72 hours, and the site hands out URLs with the version
in the filename, so every version stays reachable forever:

| version | commit    | note                                           |
|---------|-----------|------------------------------------------------|
| 0.1.0   | `2e4fea0` | first publish                                  |
| 0.2.0   | `17a93d8` | attribution button, stylesheet, framework docs |

Both were published before this workflow existed, so neither has a tag. Tagging them now
would run the release workflow as it was at those commits - the version that tried to
publish - so they are recorded here instead.
