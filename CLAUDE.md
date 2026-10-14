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
- **Version numbers:** one patch step per release (`patch`), features included, unless a change
  is major; then ask before using `minor` / `major`.
- **Releasing:** use the `release` skill. From a cloud session, dispatch `build-proxy.yml`
  on `main` with input `release` = `patch` / `minor` / `major` / `X.Y.Z`. That one run bumps,
  tags, builds and publishes.
- **Rules:**
  - Never move or delete a pushed tag.
  - Cloud sessions can push only `claude/*` branches; don't work around that.
  - Don't merge a PR without the user saying so.

## Playlist writes are OFF by default (incident)
While the stage team tested the remote, ProPresenter's install was damaged (screen
configurations lost) during playlist editing. The cause isn't established, but the user
believes it was one of the modify flows (whole-playlist `PUT`). Since then:
- The proxy forwards only GET unless started with `--allow-playlist-edits`; writes are
  refused with 403 and recorded in `pp-proxy-changes.log` (passed-on writes too).
- `api.editing` gates `editPlaylist` (the only write path); the page turns it on only when
  `GET /MODE` (served by the proxy) says `edit`. The app (no proxy) never edits.
- Don't re-enable writes by default, add new write paths, or test writes against the real
  ProPresenter without the user's explicit go-ahead and a backup.

## What ProPresenter's playlist API really accepts
Learned from real 4xx answers, so trust these over the published docs:
- **Whole playlist only.** `PUT /v1/playlist/{id}` replaces the whole item list; there's no
  per-item edit. Edits are read-modify-write: re-read, check that the item at the index still has
  the expected name, PUT once, read back. If it didn't stick, say so and send nothing more: there
  is no automatic put-back (that was a second whole-playlist PUT right after something went
  wrong). One write at a time (`api.writing`); PUTs wait up to 20 s.
- **4xx = refused.** Nothing changed, so don't restore, and show ProPresenter's reason.
- **Entry shape.** GET returns this, and PUT wants the same:
  `{id:{uuid,name,index}, type, is_hidden, is_pco, presentation_info:{presentation_uuid,
  arrangement_name, arrangement_uuid}, target_uuid, destination, duration?}`.
  Headers have `header_color` and no `presentation_info`.
- **Fields PUT is strict about:**
  - **`id.uuid` on a presentation entry must be the SONG's uuid on PUT** (= `target_uuid` /
    `presentation_uuid`), even though GET returns the entry's own id there. PUT looks the
    song up by `id.uuid` and answers a bare **404** to an entry id; ProPresenter then makes
    fresh entry ids. `putBody` does this for every write. `null` is refused ("expected a
    string"). Confirmed by another project too:
    github.com/nicolasdasilvaesilva/propresenter7-remote-web (issue #5, release v1.1.4).
  - `target_uuid` is required on every item, headers included (GET omits it on headers; send
    `""` there). On a presentation it's the presentation's uuid.
  - `presentation_info.arrangement_name` is required (`""` = no arrangement).
  - `arrangement_uuid` is required: left out → 400 missing field, `null` → 400. `""` gave a
    404 back when `id.uuid` was also wrong, so that may not have been about `""` (see MASTER
    below). "No arrangement" (MASTER) is still an arrangement, with an empty name.
- **Entry ids change after every save**, so match entries by name/position, never by id.
- **Song arrangements** come from `GET /v1/presentation/{uuid}`: `arrangements: [{id:{uuid,
  name}}]` and `current_arrangement` (a uuid). `addToPlaylist` uses the current one;
  `setArrangement` sets both the name and the matching `arrangement_uuid`. The unnamed
  arrangement is shown as **MASTER**. `song()` in pp.js reads the page once (cached 10 min)
  and gives slides in master order (= thumbnail index) and each arrangement's slide order.
  A named arrangement lists its `groups` as group uuid strings (`song()` also accepts
  `{uuid}` / `{id:{uuid}}` objects, and falls back to master order).
- **`destination`** is `"presentation"` or `"announcements"`. New songs use `"presentation"`.
- **Response shapes vary.** Libraries, macros and collections arrive either flat
  `{uuid,name}` or wrapped `{id:{...}}`; `ident()` takes both.
- **Playlist list.** `/v1/playlists` nodes have `field_type` (`playlist` / `group`) and
  `children` (older docs say `type` / `playlists`; `playlistList` takes both).
- **Hidden section.** Items under an "Announcements" header aren't rendered. Rows carry
  `data-index` (the item's index in the whole playlist), and drag computes the target index
  from the next shown row, so hidden items keep their place.
- **On air.** `live()` reads `GET /v1/status/layers` (`slide` true/false) to tell whether a
  slide is showing; the slide index keeps naming the last presentation after a clear. Falls
  back to "a presentation is live" if that request fails.
- **Live slides follow the played arrangement.** `live()` takes the arrangement from the
  active playlist entry (`/v1/playlist/active` → `playlist.uuid` + `item.index`, re-read and
  checked to be the same song), else the song's `current_arrangement`, and lists slides in
  that arrangement's group order (MASTER = the song's own order). Thumbnails go by the
  song's own order (`slide.thumb`); `slide_index` and `/presentation/active/{i}/trigger` are
  taken to count cues in the played arrangement (**unconfirmed** on real ProPresenter).
- **MASTER is ProPresenter's built-in "no arrangement"** (slides in their own order). It has a
  uuid of its own, and playlist entries using it carry `arrangement_name ""` plus that uuid.
  Some songs list it in `arrangements` (unnamed). A song with only named arrangements (e.g.
  just "Default") leaves it out, and its uuid shows only as `current_arrangement` while MASTER
  is the song's current arrangement, or on a playlist entry that uses MASTER. Once seen it's
  kept per song (`masters`, also in localStorage `ppMasters`), because switching the song to a
  named arrangement hides it again. MASTER picked while its uuid is unknown
  (`api.MASTER_NONE`) is sent as `arrangement_uuid ""` with `arrangement_name ""`, as another
  remote sends every song it adds. Whether real ProPresenter takes `""` (now that `id.uuid` is
  right) is **unconfirmed**: the old `"" → 404` was seen while `id.uuid` was still wrong. If
  it doesn't stick, the page asks the user to pick Master once in ProPresenter.
  Sending the song's own uuid as `arrangement_uuid` was answered **204 but didn't stick**
  (seen in `pp-proxy-changes.log`): a 2xx doesn't prove ProPresenter checked a field, so
  never send invented ids.
- **Named arrangements' `groups`** are plain group-uuid strings, in play order (confirmed).
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
