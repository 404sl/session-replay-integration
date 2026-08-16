# Releasing

A release is a tag. Nothing publishes without one, and the tag is somebody saying "this is
that version" rather than a side effect of a merge.

```sh
# 1. decide the version and write it down
npm version minor          # or patch / major - commits and tags in one step

# 2. make sure the file sites load matches the source
npm run build && git diff --exit-code dist/

# 3. push the commit and the tag
git push origin master --follow-tags
```

The tag starts the release workflow, which runs the tests, checks that the tag and
`package.json` agree, checks `dist/` is in step with `src/`, publishes to npm with
provenance, and cuts a GitHub release with generated notes.

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

## What has to exist first

`NPM_TOKEN` in the repository secrets, as an automation token for the `@404sl` scope. The
workflow publishes with `--access public` because the package is scoped and scoped packages
are private by default — which would fail rather than publish something unintended.
