---
name: release
description: |
  Cut a PP Remote release: bump VERSION, turn CHANGELOG's Unreleased section into
  the new version, tag vX.Y.Z and push. The tag makes CI build the single
  pp-remote-proxy.exe and publish a GitHub Release with it attached.
  Usage: /release [patch|minor|major|X.Y.Z]   (default: patch)
---

# Release PP Remote

The release is one Windows file, **`pp-remote-proxy.exe`**: the browser proxy
with the page bundled in, so it runs with no Python. It's built by the
**Build Windows proxy** workflow on a Windows runner, never locally. The iPhone
app ships separately, through TestFlight with an `ios-v*` tag (see README).

## Steps

1. **Get onto an up-to-date `main`.**
   - Release work must already be merged.
   - `git checkout main && git pull`.
   - Stop if the tree is dirty.
2. **Make sure `CHANGELOG.md` says what's shipping.**
   - Everything since the last release belongs under `## [Unreleased]`, grouped as `### Added` / `### Changed` / `### Fixed`.
   - Write for the person running it at church, not for developers.
   - If the section is empty or stale, fill it in from `git log <last tag>..HEAD`, commit that on `main`, and continue.
3. **Pick the version.**
   - The argument is `patch` (fixes), `minor` (new features) or `major` (breaking changes, such as a changed proxy command line), or an exact `X.Y.Z`.
   - The first release is `1.0.0`, from `VERSION` `0.0.0`.
4. **Dry run, and show the user:**
   `python scripts/release.py <level> --dry-run`
   It prints the old → new version and the notes. Confirm with the user before going on.
5. **Release:**
   `python scripts/release.py <level> --push`
   This:
   - re-checks that the tree is clean, on `main` and not behind origin;
   - runs the checks: `pp_proxy.py` compiles, `pp.js` parses, and the proxy starts and serves the page;
   - writes `VERSION`, renames `[Unreleased]` to `[vX.Y.Z] — date` and opens a fresh empty `[Unreleased]`;
   - commits `Release vX.Y.Z`, adds an annotated tag `vX.Y.Z`, and pushes `main` and the tag.

   If pushing from this environment isn't possible, run it without `--push` and tell the user to run `git push origin main vX.Y.Z`.
6. **Watch the build.**
   - The tag starts *Build Windows proxy*: it builds the exe, smoke-tests it (it must start and serve the page), and publishes the GitHub Release `PP Remote vX.Y.Z` with `pp-remote-proxy.exe` attached and that version's CHANGELOG section as the notes.
   - Wait for the run to finish.
   - Confirm the Release exists and the asset is attached, then give the user the Release link.
   - If the build fails, fix it on `main` and cut the next patch version. Never move or re-push an existing tag.

## Rules

- Releases come only from `main`, and only through `scripts/release.py`, so the version, changelog, commit and tag always match.
- Never delete or force-move a pushed tag. A bad release is fixed by a new one.
- The exe is never committed. It exists only as a Release asset and as a workflow artifact.
- Nothing personal ships: no person names, phone numbers or real IP addresses in the code, docs or CHANGELOG. Examples use `192.168.1.50:1025`. The one deliberate exception is the donations note at the top of the README (Zelle to giving@emanuel-church.com); keep it as it is.
