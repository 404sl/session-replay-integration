# Releasing

A release is a tag. The tag is somebody saying "this is that version" rather than a side
effect of a merge.

The publish itself is done **by hand**. The npm account has two-factor authentication on it
and a one-time code cannot be given to a workflow; an automation token would get around
that, and the account is worth more than the saved minute. So the tag follows the publish
rather than causing it.

```sh
# 1. decide the version and write it down
npm version minor          # or patch / major - commits and tags in one step

# 2. make sure the file sites load matches the source
npm run build && git diff --exit-code dist/

# 3. publish, from master, with nothing uncommitted. npm asks for the one-time code:
npm publish --access public

# 4. push the commit and the tag
git push origin master --follow-tags
```

`--access public` because the package is scoped, and scoped packages are private by default
- which would fail rather than publish something unintended.

The tag starts the release workflow. It does not publish: it runs the tests, checks that the
tag and `package.json` agree, checks `dist/` is in step with `src/`, checks that the version
the tag names is the one the registry is actually serving and that the published files match
what the tag points at, and then cuts a GitHub release with generated notes. A red run means
the tag and the published package disagree, which is worth knowing.

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
