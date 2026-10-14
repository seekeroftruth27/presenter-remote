# PP Remote

A phone and iPad remote for **ProPresenter 7** (7.9 or later), using its network API.

- **Remote tab:**
  - **Live** panel: the slide on screen now (thumbnail, "Slide n of N", group, text).
  - **Preview** of the live item's slides, with a 1–5 column zoom. The grid follows the live slide, and you **double-tap** a slide to show it (a single tap does nothing).
  - Big **PREV / NEXT** buttons at the bottom, and a small **Clear slide** beside the zoom.
    Clear slide also runs the **Speaking** macro.
  - The **Remote** tab is green while nothing is on screen, and fades slowly in and
    out of red while a slide is showing (seen from any tab), reading **LIVE**.
- **Playlist tab** (read-only unless editing is switched on; see below):
  - Each song's **arrangement** from its own list in ProPresenter: **MASTER**
    (the slides in order) first, then the named arrangements.
  - **⌄** shows the song's slides in the chosen arrangement's order, four to a row.
    The preview is view only: tapping a slide does nothing.
  - **▶** (double-tap) puts an item on screen; it's on the right, with 🗑 to its left.
  - **≡** drag to reorder (the held song shrinks a little and the others slide
    aside as it passes), and **🗑** remove. Tapping a song's title opens or closes
    its preview, like ⌄.
  - **Add** presentations from a library (with search).
  - Items under an **Announcements** header aren't shown: they aren't the stage
    team's. They stay in the playlist, untouched.
- **Macros tab:**
  - The macros in ProPresenter's **Default Collection** macro collection, in that
    collection's order, as buttons in their own colours. Change what the stage
    team sees by editing that collection in ProPresenter. The collection's name
    is `MACRO_COLLECTION` in `web/index.html`.
  - The first tap arms a macro; a second tap within 3 s runs it.

> **Free to use.** If PP Remote helps your church, donations are welcome by
> **Zelle** to **giving@emanuel-church.com**. Thank you!

It comes two ways. Both are the same page (`web/`), and all ProPresenter calls are in `web/pp.js`.

| | Needs | Good for |
|---|---|---|
| **iPhone app** (`mobile/`) | Nothing running at church but ProPresenter | Everyday use |
| **Browser + proxy** (`proxy/`) | `pp-remote-proxy.exe` (or Python) running on a PC on the same network | Any phone, no install on the phone |

## Set up ProPresenter

In ProPresenter: **Settings → Network**, turn on **Enable Network**, and note the
**IP address and port**. Give that computer a fixed IP (a DHCP reservation in the
router) so the address doesn't change between Sundays.

## Browser + proxy

ProPresenter's API sends no CORS headers, so a web page can't call it directly.
The proxy serves the page and forwards its `/v1/...` calls to ProPresenter. It
forwards only `/v1/` paths, and only to that one address.

**Read-only by default.** The proxy passes on only requests that read or show
things (slides, playlist items, macros). Playlist changes (add, remove, reorder,
arrangements) are refused, and the page hides those controls. To allow them,
start the proxy with `--allow-playlist-edits` (for example
`pp-remote-proxy.exe --allow-playlist-edits`). It then records every change it
sends in `pp-proxy-changes.log` beside the exe. Editing replaces a whole playlist
in ProPresenter, so **back up ProPresenter first** and try it on a test playlist.

**Windows:** download **pp-remote-proxy-exe** from the latest *Build Windows proxy*
run (Actions tab → the run → Artifacts) and run it. The first time, it asks for
ProPresenter's address and remembers it in `pp-proxy.txt` beside the exe.
If ProPresenter refuses a change, the proxy writes what it sent and what came
back to `pp-proxy-errors.log` beside the exe. Send that file when reporting a
problem.

**Any OS with Python 3:** `python proxy/pp_proxy.py 192.168.1.50:1025 [--port 8080]`

It prints the address to open on the phone, e.g. `http://192.168.1.20:8080`.
In Safari, use *Share → Add to Home Screen* to open it full-screen.

## iPhone app

`mobile/` packages `web/` with [Capacitor](https://capacitorjs.com). Inside the
app, Capacitor's native HTTP carries every request, and native requests aren't
subject to CORS, so the app calls ProPresenter itself. On first launch it opens
**⚙**: enter ProPresenter's address and tap **Save & connect**. iOS asks once for
local-network access; allow it.

### Building without a Mac

The **Build iPhone app** workflow builds on GitHub's macOS runners:

- **Every push that touches `web/` or `mobile/`:** a compile check, plus
  **PP-Remote-unsigned-ipa** under the run's Artifacts.
- **Tag `ios-v…`** (`git tag ios-v1 && git push origin ios-v1`, a new number each
  time): a signed build uploaded to **TestFlight**. This needs:
  - an Apple Developer account ($99/yr; nonprofits can apply for a fee waiver);
  - an App Store Connect app with bundle ID `org.aron.ppremote`;
  - the four secrets listed at the top of `.github/workflows/build-ios.yml`.

### Testing without App Store Connect (free, 7 days at a time)

1. Download **PP-Remote-unsigned-ipa** from a build and unzip it.
2. Install [Sideloadly](https://sideloadly.io) on Windows or Mac. On Windows,
   also install iTunes and iCloud from Apple's site, not the Microsoft Store.
3. Plug in the iPhone, drag the `.ipa` into Sideloadly, enter your Apple ID, and
   click **Start**.
4. On the iPhone:
   - **Settings → Privacy & Security → Developer Mode** on.
   - **Settings → General → VPN & Device Management** → trust your Apple ID.

A free Apple ID's install stops opening after 7 days. Run Sideloadly again to
renew it.

### Building on a Mac

```
cd mobile
npm ci
npm run sync        # copy web/ into the iOS project
npx cap open ios    # Xcode: pick your team under Signing, then Run
```

## How editing a playlist works

ProPresenter's API can't change one playlist item on its own. It can only replace
the whole playlist. So every edit (arrangement, add, remove) works like this:

1. Re-read the playlist, and check the item is still the one the phone showed.
2. Write the whole playlist back.
3. Read it again to confirm the change took.
4. If it didn't take, put the original back.

If ProPresenter refuses a write outright, nothing changed, and the page shows
ProPresenter's own reason. Planning Center playlists are left read-only.

A song's arrangements and slides come from ProPresenter itself. Each song is read
once and reused for 10 minutes (↻ reads them again), two songs at a time.

## Notes

- **Light on ProPresenter:**
  - It polls once a second, and only while the Remote tab is open.
  - Thumbnails load only near the screen, two at a time.
  - Songs (arrangements, slides) are read two at a time and reused for 10 minutes.
- **Not authenticated:** anyone on the same network who can reach the proxy or
  ProPresenter can control it. That's the same as ProPresenter's own API.
- **Confirmed on real ProPresenter** (v1.1.5): adding from a library and the 404
  fix for playlist edits, plus macros from the Default Collection. New features
  are worth trying on a test playlist first; if ProPresenter refuses anything,
  send `pp-proxy-errors.log`.

## Releasing

Each release is one Windows file, `pp-remote-proxy.exe`, built by CI and attached
to a GitHub Release. Add changes under `## [Unreleased]` in `CHANGELOG.md` as you
go, then on an up-to-date `main` run the **`release`** skill (`/release
[patch|minor|major|X.Y.Z]`), or the script it drives:

```
python scripts/release.py minor --dry-run   # check the version and notes
python scripts/release.py minor --push      # bump, commit, tag vX.Y.Z, push
```

The `vX.Y.Z` tag starts **Build Windows proxy**, which builds and smoke-tests the
exe and publishes the Release with it attached and that version's notes.

Or release in **one step on GitHub**, with no local checkout: **Actions → Build
Windows proxy → Run workflow**, on `main`, with **release** set to `patch`,
`minor`, `major` or `X.Y.Z`. It runs the same script on GitHub (checks, bump,
changelog, commit, tag), pushes `main` and the tag, and builds and publishes the
release. Cloud sessions use this route, since they can't push `main` themselves.
