# PP Remote: notes for Claude

A phone/iPad remote for ProPresenter 7, using its network API (`/v1/...`). See
README.md for features and setup, and CHANGELOG.md for the history.

## Layout
- `web/index.html`: the whole UI (Remote, Playlist and Macros tabs, plus ⚙ in the app).
- `web/pp.js`: every ProPresenter call. `PPDirect.create(base)`.
- `proxy/pp_proxy.py`: stdlib proxy. It serves `web/` and forwards only `/v1/...` to
  ProPresenter, because the API sends no CORS headers. CI freezes it into `pp-remote-proxy.exe`.
- `mobile/`: Capacitor iPhone app. Native HTTP, so it needs no proxy.
- `scripts/release.py` and `.claude/skills/release/`: the release flow.

## Builds and releases (no Mac or Windows machine needed)
- **Windows exe:** *Build Windows proxy* (`build-proxy.yml`) builds on GitHub's Windows runners.
- **iPhone app:** *Build iPhone app* (`build-ios.yml`) builds on GitHub's macOS runners.
- **Releasing:** use the `release` skill. From a cloud session, dispatch `build-proxy.yml`
  on `main` with input `release` = `patch` / `minor` / `major` / `X.Y.Z`. That one run bumps,
  tags, builds and publishes.
- **Rules:**
  - Never move or delete a pushed tag.
  - Cloud sessions can push only `claude/*` branches; don't work around that.
  - Don't merge a PR without the user saying so.

## What ProPresenter's playlist API really accepts
Learned from real 4xx answers, so trust these over the published docs:
- **Whole playlist only.** `PUT /v1/playlist/{id}` replaces the whole item list; there's no
  per-item edit. Edits are read-modify-write: re-read, check that the item at the index still has
  the expected name, PUT, read back, and restore only if the PUT was accepted but didn't stick.
- **4xx = refused.** Nothing changed, so don't restore, and show ProPresenter's reason.
- **Entry shape.** GET returns this, and PUT wants the same:
  `{id:{uuid,name,index}, type, is_hidden, is_pco, presentation_info:{presentation_uuid,
  arrangement_name, arrangement_uuid}, target_uuid, destination, duration?}`.
  Headers have `header_color` and no `presentation_info`.
- **Fields PUT is strict about:**
  - `id.uuid` must be a UUID string. `null` is refused ("expected a string"). A **new** entry
    needs a fresh random v4 UUID; it's the entry's own id, not the song's.
  - `target_uuid` is required on every item, headers included (GET omits it on headers; send
    `""` there). On a presentation it's the presentation's uuid.
  - `presentation_info.arrangement_name` is required (`""` = no arrangement).
  - `arrangement_uuid`: real entries always have one, even with an empty name. What a new
    entry should send is **unconfirmed**. `addToPlaylist` tries the field left out, then
    `null`, then `""`.
- **`destination`** is `"presentation"` or `"announcements"`. New songs use `"presentation"`.
- **Response shapes vary.** Libraries, macros and collections arrive either flat
  `{uuid,name}` or wrapped `{id:{...}}`; `ident()` takes both.
- **Playlist list.** `/v1/playlists` nodes have `field_type` (`playlist` / `group`) and
  `children`.
- **Macros tab.** Shows the macro collection named "Default Collection" (or plain "Default")
  from `/v1/macro_collections`.

## Diagnosing a refusal
When ProPresenter refuses a write, the proxy appends what it sent and what came back to
`pp-proxy-errors.log` beside the exe. Ask the user for that file instead of guessing. The
error's column number points into the sent JSON.

## Testing
- **Locally:** `python -m py_compile proxy/pp_proxy.py` and `node --check web/pp.js`.
- **In a browser:** run the proxy against a small fake ProPresenter (a stdlib HTTP server
  answering the `/v1` paths you need, with the rules above enforced on PUT), and drive the page
  with Playwright. Reproduce the user's exact error first, then show the fix passes.
- **Real ProPresenter:** a local session may be able to reach it over the church VPN.
  - Use read-only requests first (`GET /version`, `/v1/playlists`, `/v1/playlist/{id}`).
  - Test edits only on a scratch playlist the user creates; never on MAIN or anything live.
  - The API has no authentication; don't expose it to the internet.

## Privacy
Nothing personal ships: no person names, phone numbers, real IPs or real playlist contents in
code, docs, tests or the CHANGELOG. Examples use `192.168.1.50:1025`. The one deliberate
exception is the Zelle donation note in the README and release notes.
