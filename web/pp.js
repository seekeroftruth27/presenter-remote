// Every call the remote makes to ProPresenter's network API (Settings -> Network
// in ProPresenter). The page creates one client with PPDirect.create(base):
//   - in the iPhone app, base is ProPresenter's own address; Capacitor's native
//     HTTP carries fetch(), and native requests aren't subject to CORS;
//   - in a browser, base is the page's own origin: proxy/pp_proxy.py serves the
//     page and forwards /v1/... to ProPresenter, because ProPresenter's API
//     sends no CORS headers and a browser would block the calls otherwise.

(() => {
  // A song's details (arrangements, slides) are read once and reused this long:
  // ProPresenter may be busy running the service on the same PC.
  const SONG_TTL_MS = 10 * 60 * 1000;
  const ACTIONS = {
    "next": ["/v1/trigger/next"],
    "previous": ["/v1/trigger/previous"],
    "clear-slide": ["/v1/clear/layer/slide"],
  };

  function normalize(url) {
    url = (url || "").trim().replace(/\/+$/, "");
    if (url && !/^[a-z]+:\/\//i.test(url)) url = "http://" + url;
    return url;
  }

  function create(baseUrl) {
    const base = normalize(baseUrl);
    const enc = encodeURIComponent;

    async function call(method, path, body, timeoutMs = 4000) {
      if (!base) throw new Error("Set the ProPresenter address first");
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctl && setTimeout(() => ctl.abort(), timeoutMs);
      let r;
      try {
        r = await fetch(base + path, {
          method,
          headers: Object.assign({ Accept: "application/json" },
                                 body === undefined ? {} : { "Content-Type": "application/json" }),
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ctl ? ctl.signal : undefined,
          cache: "no-store",
        });
      } catch (e) {
        throw new Error(e && e.name === "AbortError" ? "ProPresenter didn't answer"
                                                     : `Can't reach ProPresenter (${e.message || e})`);
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (r.status >= 400 && r.status < 500 && method !== "GET") {
        // ProPresenter refused the write, so nothing changed; pass on its reason.
        const reason = (await r.text().catch(() => "")).trim().slice(0, 200);
        const e = new Error(`HTTP ${r.status}${reason ? ": " + reason : ""}`);
        e.refused = true;
        throw e;
      }
      if (r.status !== 200 && r.status !== 204) throw new Error(`ProPresenter HTTP ${r.status}`);
      return r;
    }

    // A playlist as ProPresenter's PUT will take it. Every field it read out goes
    // back as it was, except where its own errors have asked otherwise:
    //   - on a song (presentation) entry, id.uuid must be the SONG's uuid, not
    //     the entry's: GET gives the entry's own id there (the song's is in
    //     target_uuid), but PUT looks the song up by id.uuid and answers 404 to
    //     an entry id. ProPresenter makes fresh entry ids after the PUT.
    //   - target_uuid is required on every item ("missing field `target_uuid`");
    //   - presentation_info needs arrangement_name ("missing field
    //     `arrangement_name`"), "" meaning no arrangement.
    // Nothing is ever dropped: leaving out empty fields is what lost them.
    function putBody(items) {
      return JSON.parse(JSON.stringify(items)).map(it => {
        if (it.target_uuid === undefined || it.target_uuid === null) it.target_uuid = "";
        if (it.type === "presentation" && it.id && typeof it.id === "object") {
          const song = itemPresentation(it);
          if (song) it.id.uuid = song;
        }
        const info = it.presentation_info;
        if (info && typeof info === "object" && (info.arrangement_name === undefined || info.arrangement_name === null))
          info.arrangement_name = "";
        return it;
      });
    }

    async function getJSON(path) {
      const r = await call("GET", path);
      const text = await r.text();
      return text ? JSON.parse(text) : null;
    }

    function color(c) {
      if (!c) return "";
      const h = v => Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 255)
                       .toString(16).padStart(2, "0");
      return "#" + h(c.red) + h(c.green) + h(c.blue);
    }

    // A library or library item's {uuid, name}. The published API wraps these in
    // an "id" object, but ProPresenter has been seen to send them flat; take either.
    function ident(obj) {
      const id = obj && typeof obj.id === "object" && obj.id ? obj.id : (obj || {});
      return { uuid: id.uuid || "", name: id.name || "" };
    }

    function unrecognised(raw, what) {
      const first = raw[0];
      const keys = first && typeof first === "object" ? Object.keys(first).sort().join(", ") : typeof first;
      return new Error(`ProPresenter sent ${what} in a format this doesn't recognise (fields: ${keys}). Please report this.`);
    }

    function checkItem(items, index, expectedName) {
      if (!(index >= 0 && index < items.length) || ((items[index].id || {}).name) !== expectedName)
        throw new Error("The playlist changed in ProPresenter. Reload and try again.");
    }

    // A song, from GET /v1/presentation/{uuid}, cached for SONG_TTL_MS:
    //   slides: [{text, group, color}] in master order (index = thumbnail index)
    //   arrangements: [{uuid, name, order}], order = slide indexes in play order.
    //     "No arrangement" (the MASTER) is an arrangement with an empty name.
    //   current: uuid of the song's current arrangement.
    // A playlist entry must name one of these by uuid (ProPresenter answers 404
    // to anything else).
    const songCache = new Map();
    async function song(uuid, fresh) {
      const hit = songCache.get(uuid);
      if (!fresh && hit && Date.now() - hit.at < SONG_TTL_MS) return hit.data;
      const p = ((await getJSON(`/v1/presentation/${enc(uuid)}`)) || {}).presentation || {};
      const slides = [], byGroup = {};
      for (const g of p.groups || []) {
        const idx = [];
        for (const sl of g.slides || []) {
          idx.push(slides.length);
          slides.push({ text: (sl && sl.text) || "", group: g.name || "", color: color(g.color) });
        }
        if (g.uuid) byGroup[g.uuid] = idx;
      }
      const master = slides.map((_, i) => i);
      const groupId = g => typeof g === "string" ? g : (g && (g.uuid || (g.id && g.id.uuid))) || "";
      const arrangements = (p.arrangements || []).map(a => {
        const { uuid: id, name } = ident(a);
        const groups = (a && a.groups) || [];
        const order = groups.length ? groups.flatMap(g => byGroup[groupId(g)] || []) : master;
        const nm = name.trim();
        return { uuid: id, name: /^master$/i.test(nm) ? "" : nm, order: order.length ? order : master };
      }).filter(a => a.uuid);
      const current = typeof p.current_arrangement === "string" ? p.current_arrangement : "";
      // MASTER (no arrangement) isn't always listed: a song with only named
      // arrangements leaves it out, but when MASTER is the song's current
      // arrangement, current_arrangement carries its uuid.
      if (!arrangements.some(a => !a.name) && current && !arrangements.some(a => a.uuid === current))
        arrangements.unshift({ uuid: current, name: "", order: master });
      const data = { uuid, slides, arrangements, masterOrder: master, current };
      songCache.set(uuid, { at: Date.now(), data });
      return data;
    }

    function itemPresentation(it) {
      return (it.presentation_info || {}).presentation_uuid || it.target_uuid || "";
    }

    async function playlistList() {
      const out = [];
      (function walk(nodes, prefix) {
        for (const n of nodes || []) {
          const id = n.id || {};
          const kind = n.field_type || n.type;
          if (kind === "group") walk(n.children || n.playlists, `${prefix}${id.name || ""} / `);
          else if (id.uuid) out.push({ uuid: id.uuid, name: prefix + (id.name || "") });
        }
      })(await getJSON("/v1/playlists"), "");
      return out;
    }

    return {
      base,

      // What the preview shows: live presentation, current cue, playlist item.
      // Slides only when the presentation differs from `have`.
      async live(have) {
        const idx = ((await getJSON("/v1/presentation/slide_index")) || {}).presentation_index || {};
        const pid = idx.presentation_id || {};
        const uuid = pid.uuid || "";
        const out = { ok: true, uuid, name: pid.name || "", index: uuid ? idx.index : null,
                      playlist: "", item: "", showing: !!uuid };
        // Whether a slide is on screen: the slide index keeps naming the last
        // presentation after a clear, so ask for the slide layer's state.
        try {
          const layers = await getJSON("/v1/status/layers");
          if (layers && typeof layers.slide === "boolean") out.showing = layers.slide;
        } catch { /* older ProPresenter: fall back to "a presentation is live" */ }
        try {
          const active = ((await getJSON("/v1/playlist/active")) || {}).presentation || {};
          out.playlist = (active.playlist || {}).name || "";
          out.item = (active.item || {}).name || "";
        } catch { /* not from a playlist -- fine */ }
        if (uuid && have !== uuid) {
          const pres = ((await getJSON("/v1/presentation/active")) || {}).presentation || {};
          out.slides = [];
          for (const g of pres.groups || []) {
            for (const s of g.slides || []) {
              out.slides.push({ group: g.name || "", color: color(g.color), label: s.label || "",
                                text: (s.text || "").trim(), enabled: s.enabled !== false });
            }
          }
        }
        return out;
      },

      async action(name) {
        const paths = ACTIONS[name];
        if (!paths) throw new Error("unknown action");
        for (const p of paths) await call("GET", p);
        return { ok: true };
      },

      // Jump to a cue of the live presentation, only if it's still the one shown.
      async goto(uuid, index) {
        if (!Number.isInteger(index) || index < 0) throw new Error("bad index");
        const idx = ((await getJSON("/v1/presentation/slide_index")) || {}).presentation_index || {};
        if (((idx.presentation_id || {}).uuid || "") !== (uuid || ""))
          throw new Error("A different presentation is live now.");
        await call("GET", `/v1/presentation/active/${index}/trigger`);
        return { ok: true };
      },

      thumbUrl(uuid, index) {
        return `${base}/v1/presentation/${enc(uuid)}/thumbnail/${index}?quality=320&thumbnail_type=jpeg`;
      },

      // The thumbnail as a blob: URL, for when the web view won't load the plain
      // http image itself (fetch goes native, so it isn't blocked).
      async thumbBlobUrl(uuid, index) {
        const r = await call("GET", `/v1/presentation/${enc(uuid)}/thumbnail/${index}?quality=320&thumbnail_type=jpeg`);
        return URL.createObjectURL(await r.blob());
      },

      async playlists() {
        return { ok: true, playlists: await playlistList() };
      },

      async playlist(id) {
        const pl = (await getJSON(`/v1/playlist/${enc(id)}`)) || {};
        const items = (pl.items || []).map((it, i) => ({
          index: i,
          name: (it.id || {}).name || "",
          type: it.type || "",
          is_pco: !!it.is_pco,
          song: it.type === "presentation" ? itemPresentation(it) : "",
          arrangement: (it.presentation_info || {}).arrangement_name || "",
          arrangementUuid: (it.presentation_info || {}).arrangement_uuid || "",
        }));
        return { ok: true, name: (pl.id || {}).name || "", items };
      },

      // A song's slides and arrangements (see song()); fresh = don't reuse.
      song(uuid, fresh) { return song(uuid, fresh); },

      // Put a playlist on screen: its first item, or (index given) that item,
      // only if the playlist still has `expectedName` there.
      async triggerPlaylist(id, index, expectedName) {
        const path = `/v1/playlist/${enc(id)}`;
        if (index === undefined || index === null) {
          await call("GET", `${path}/trigger`);
          return { ok: true };
        }
        const items = ((await getJSON(path)) || {}).items || [];
        if (!(index >= 0 && index < items.length) || ((items[index].id || {}).name) !== expectedName)
          throw new Error("The playlist changed in ProPresenter. Reload and try again.");
        if (items[index].type === "header") throw new Error("That's a header, not something to show");
        const ppIndex = (items[index].id || {}).index;
        await call("GET", `${path}/${Number.isInteger(ppIndex) ? ppIndex : index}/trigger`);
        return { ok: true };
      },

      // Edit a playlist the only way the API allows: read it whole, change it,
      // write it back once, read it again to confirm. `edit(items)` changes items
      // in place (or throws) and returns kept(after). A write ProPresenter refuses
      // (4xx) changed nothing. One it took that didn't stick is reported, and
      // nothing more is sent: a second whole-playlist write (the old automatic
      // put-back) is exactly what we don't want after something went wrong.
      // One write at a time, so taps can't stack whole-playlist PUTs.
      // Playlist editing is off unless the page turns it on (it does only when the
      // proxy says it was started with --allow-playlist-edits). Every playlist
      // change goes through editPlaylist, so this is the one gate.
      editing: false,
      writing: false,
      setEditing(on) { this.editing = !!on; },

      async editPlaylist(id, edit) {
        if (!this.editing) throw new Error("Playlist editing is turned off.");
        if (this.writing) throw new Error("Still saving the last change. Try again in a moment.");
        this.writing = true;
        try {
          const path = `/v1/playlist/${enc(id)}`;
          const items = ((await getJSON(path)) || {}).items || [];
          if (items.some(it => it.is_pco))
            throw new Error("This playlist is linked to Planning Center; edit it there.");
          const kept = edit(items);
          items.forEach((it, i) => { if (it.id && typeof it.id === "object") it.id.index = i; });

          try {
            await call("PUT", path, putBody(items), 20000);
          } catch (e) {
            if (e.refused) throw Object.assign(new Error(`ProPresenter refused the change (${e.message}). Nothing was changed.`), { refused: true });
            throw new Error(`ProPresenter didn't confirm the change (${e.message}). Reload and check the playlist before trying again.`);
          }
          if (!kept(((await getJSON(path)) || {}).items || []))
            throw new Error("ProPresenter took the change but the playlist doesn't show it. Nothing else was sent; reload and check the playlist.");
          return { ok: true };
        } finally {
          this.writing = false;
        }
      },

      // Set an entry's arrangement to one of its song's own (by uuid; the MASTER
      // is the one with an empty name). ProPresenter goes by arrangement_uuid;
      // arrangement_name is kept in step with it. MASTER has a uuid of its own,
      // but a song with only named arrangements lists it only while MASTER is
      // the song's current arrangement (see song()). MASTER_NONE = MASTER picked
      // when song() didn't find it: then a playlist entry of the same song that
      // already uses MASTER supplies the uuid, or nothing is written. (Sending
      // the song's own uuid was accepted with 204 but didn't stick, so invented
      // ids are never sent.)
      MASTER_NONE: "\u0000master",
      async setArrangement(id, index, expectedName, arrangementUuid) {
        const peek = ((await getJSON(`/v1/playlist/${enc(id)}`)) || {}).items || [];
        checkItem(peek, index, expectedName);
        if (peek[index].type !== "presentation") throw new Error("Only songs/presentations have arrangements");
        const songId = itemPresentation(peek[index]);
        const s = await song(songId, true);
        if (arrangementUuid === this.MASTER_NONE) {
          const m = s.arrangements.find(a => !a.name) ||
            peek.filter(it => it.type === "presentation" && itemPresentation(it) === songId)
                .map(it => it.presentation_info || {})
                .filter(i => !i.arrangement_name && i.arrangement_uuid &&
                             !s.arrangements.some(a => a.uuid === i.arrangement_uuid))
                .map(i => ({ uuid: i.arrangement_uuid, name: "" }))[0];
          if (!m) throw new Error(`The remote can't find MASTER for "${expectedName}" yet. Pick Master for it once in ProPresenter, then it works here too. Nothing was changed.`);
          if (!s.arrangements.some(a => a.uuid === m.uuid)) s.arrangements.unshift(m);
          arrangementUuid = m.uuid;
        }
        const arr = s.arrangements.find(a => a.uuid === arrangementUuid);
        if (!arr) throw new Error(`That arrangement isn't in "${expectedName}" any more. Reload and try again.`);
        return this.editPlaylist(id, items => {
          checkItem(items, index, expectedName);
          const info = Object.assign({}, items[index].presentation_info || {});
          if (!info.presentation_uuid) info.presentation_uuid = itemPresentation(items[index]);
          info.arrangement_name = arr.name;
          info.arrangement_uuid = arr.uuid;
          items[index].presentation_info = info;
          const n = items.length;
          return after => after.length === n &&
            (((after[index] || {}).presentation_info || {}).arrangement_name || "") === arr.name;
        });
      },

      // Run the macro with this name (case and spacing ignored), if there is one.
      async triggerMacroNamed(name) {
        const key = s => String(s || "").trim().toLowerCase();
        const m = (await this.macros()).macros.find(x => key(x.name) === key(name));
        if (!m) throw new Error(`There's no "${name}" macro in ProPresenter.`);
        return this.triggerMacro(m.uuid);
      },

      // Add a library presentation to the end of a playlist, shaped like the
      // entries ProPresenter itself returns:
      //   {id:{uuid,name,index}, type:"presentation", is_hidden, is_pco,
      //    presentation_info:{presentation_uuid, arrangement_name, arrangement_uuid},
      //    target_uuid, destination}
      // On a PUT, id.uuid is the song's uuid (see putBody).
      // arrangement_uuid must be one of the song's own arrangements (left out,
      // null and "" are all refused), so the song's current one is read first.
      async addToPlaylist(id, uuid, name) {
        if (!uuid) throw new Error("missing presentation");
        name = (name || "").trim().slice(0, 200);
        const s = await song(uuid);
        const arr = s.arrangements.find(a => a.uuid === s.current) || s.arrangements[0];
        if (!arr) throw new Error(`ProPresenter didn't list any arrangement for "${name}", so it can't be added from here.`);
        return this.editPlaylist(id, items => {
          const n = items.length;
          items.push({ id: { uuid, name, index: n }, type: "presentation",
                       is_hidden: false, is_pco: false,
                       presentation_info: { presentation_uuid: uuid, arrangement_name: arr.name,
                                            arrangement_uuid: arr.uuid },
                       target_uuid: uuid, destination: "presentation" });
          return after => after.length === n + 1 && itemPresentation(after[n]) === uuid;
        });
      },

      async removeFromPlaylist(id, index, expectedName) {
        return this.editPlaylist(id, items => {
          checkItem(items, index, expectedName);
          items.splice(index, 1);
          const names = items.map(it => (it.id || {}).name);
          return after => after.length === names.length &&
            after.every((it, i) => (it.id || {}).name === names[i]);
        });
      },

      // Move one item to another position (both are indexes in the playlist as
      // the phone showed it), only if `expectedName` is still at `from`.
      async moveInPlaylist(id, from, to, expectedName) {
        return this.editPlaylist(id, items => {
          checkItem(items, from, expectedName);
          if (!(to >= 0 && to < items.length)) throw new Error("The playlist changed in ProPresenter. Reload and try again.");
          items.splice(to, 0, items.splice(from, 1)[0]);
          const names = items.map(it => (it.id || {}).name);
          return after => after.length === names.length &&
            after.every((it, i) => (it.id || {}).name === names[i]);
        });
      },

      async macros() {
        let raw = await getJSON("/v1/macros");
        if (raw && !Array.isArray(raw)) raw = raw.macros || raw.items || [];
        const macros = (raw || []).map(m => Object.assign(ident(m), { color: color((m || {}).color) }))
                                  .filter(m => m.uuid);
        if (raw && raw.length && !macros.length) throw unrecognised(raw, "its macros");
        return { ok: true, macros };
      },

      // Macro collections (ProPresenter's Macros panel groups): [{name, uuids}],
      // each listing its macros' uuids in the collection's order.
      async macroCollections() {
        let raw = await getJSON("/v1/macro_collections");
        if (raw && !Array.isArray(raw)) raw = raw.macro_collections || raw.collections || raw.items || [];
        const cols = (raw || []).map(c => ({
          name: ident(c).name,
          uuids: ((c || {}).macros || []).map(m => ident(m).uuid).filter(Boolean),
        }));
        if (raw && raw.length && !cols.some(c => c.name)) throw unrecognised(raw, "its macro collections");
        return { ok: true, collections: cols };
      },

      async triggerMacro(id) {
        if (!/^[0-9A-Za-z-]{1,64}$/.test(id || "")) throw new Error("bad id");
        await call("GET", `/v1/macro/${id}/trigger`);
        return { ok: true };
      },

      async libraries() {
        let raw = await getJSON("/v1/libraries");
        if (raw && !Array.isArray(raw)) raw = raw.libraries || raw.items || [];
        const libraries = (raw || []).map(ident).filter(l => l.uuid);
        if (raw && raw.length && !libraries.length) throw unrecognised(raw, "its libraries");
        return { ok: true, libraries };
      },

      async library(id) {
        let raw = (await getJSON(`/v1/library/${enc(id)}`)) || {};
        if (!Array.isArray(raw)) raw = raw.items || [];
        const items = raw.map(ident).filter(it => it.uuid)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        if (raw.length && !items.length) throw unrecognised(raw, "this library");
        return { ok: true, items };
      },
    };
  }

  window.PPDirect = { create, normalize };
})();
