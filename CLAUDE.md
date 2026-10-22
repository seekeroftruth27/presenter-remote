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
- **Arrangements can't be set through the API (tested on real ProPresenter, Oct 2026).** A
  playlist entry always carries its song's current arrangement (`current_arrangement`), and
  PUT ignores whatever arrangement it's sent, answering 204 anyway: switching an entry to
  "Default" (its real uuid), from one named arrangement to another ("Default" → "Test", both
  listed), to MASTER (its real uuid, saved while it was current), to `""`,
  to the all-zeros uuid, and adding a song with a named arrangement all came back unchanged.
  The published API (openapi.propresenter.com/swagger.json) has no endpoint that writes a
  presentation. So the Playlist tab shows the arrangement and doesn't offer to change it;
  picking it in ProPresenter changes the song and every entry follows. `addToPlaylist` still
  sends the song's current one (`arrangement_uuid` is required) and reports it back.
- **Song arrangements** come from `GET /v1/presentation/{uuid}`: `arrangements: [{id:{uuid,
  name}}]` and `current_arrangement` (a uuid). The unnamed arrangement is shown as **MASTER**
  (the slides in the order they were entered). `song()` in pp.js reads the page once (cached
  10 min) and gives slides in master order and each arrangement's slide order. A named
  arrangement lists its `groups` as group uuid strings (`song()` also accepts `{uuid}` /
  `{id:{uuid}}` objects, and falls back to master order).
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
- **Live slides follow the played arrangement**, which is the song's `current_arrangement`
  (a playlist entry always carries it, see above; `live()` doesn't re-read the playlist).
  Slides are listed in that arrangement's group order (MASTER = the song's own order). `slide_index` counts cues
  in the played arrangement (**confirmed**: the first Bridge of a "Default" song played from a
  playlist gave `index 15`, `total_cues 21`). `/presentation/active/{i}/trigger` is taken to
  count the same way (not tested: it changes the screen).
- **Just after a song starts, answers can lag.** `/presentation/active` may briefly be the
  previous song or have no slides, and `slide_index` may name no presentation. `live()` marks
  such answers `unsettled` (presentation id ≠ slide_index's, or no slides); the page doesn't
  keep them for up to 3 s (`SETTLE_WAIT_MS`; after that the answer is taken as is, so it
  can't freeze), needs two "nothing showing" answers in a row before clearing, and re-reads
  2 s after a playlist trigger. The highlight keeps following on the grid already shown. Keeping the first answer left the grid empty or on the old song.
  **After switching songs from a playlist** (e.g. song A live, then song B triggered),
  `slide_index` stays `null` until the slide changes, while `status/layers.slide` is true and
  `/presentation/active` is the new song (seen on real ProPresenter, over a minute). `live()`
  then takes the song from `/presentation/active` if it's the playlist's active item (index
  null, no highlight). In that state `/presentation/active/{i}/trigger` answers 404, so
  `goto` uses `/presentation/focused/{i}/trigger` when active and focused are both the song
  (tested: it works, and `slide_index` comes back).
  Likewise after a slide jump `slide_index` can still give the old slide: for 2.5 s
  (`JUMP_SETTLE_MS`) the page ignores that old index (any other index is taken as is).
- **Thumbnails go by the song's CURRENT arrangement** (confirmed on real ProPresenter): a song
  whose current arrangement is "Default" (21 cues with repeats) has thumbnails 0..20 in that
  order, while `total_cues` still says 11 (the song's own slide count). So a slide's thumbnail
  is where it first comes in the current arrangement (`thumbIndexes`; -1 = not in it, show the
  text). MASTER is listed in `arrangements` with `groups: []` (= the song's own order).
- **MASTER has a uuid of its own**, but a song lists it in `arrangements` only while MASTER
  is its current arrangement; otherwise it's hidden (and `song()` adds the current one if it
  isn't listed). MASTER's `groups` is `[]` (= the song's own order).
- **No live stage picture in the API.** `GET /v1/stage/layout/{id}/thumbnail` (layout from
  `/v1/stage/screens` → `/v1/stage/screen/{id}/layout`) is only the layout's template, not the
  live stage screen (checked on real ProPresenter, v1.3.13). So the Remote tab's big picture
  is drawn by the page like the church's Current/Next stage screen: the live slide's lyrics
  in bold capitals (top 70%), a band in the next slide's group colour, darkened, naming it (8%), the next
  slide's lyrics (22%) (`showLive`, `fitStage`), from the slides it already has.
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
