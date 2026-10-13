// Every call the remote makes to ProPresenter's network API (Settings -> Network
// in ProPresenter). The page creates one client with PPDirect.create(base):
//   - in the iPhone app, base is ProPresenter's own address; Capacitor's native
//     HTTP carries fetch(), and native requests aren't subject to CORS;
//   - in a browser, base is the page's own origin: proxy/pp_proxy.py serves the
//     page and forwards /v1/... to ProPresenter, because ProPresenter's API
//     sends no CORS headers and a browser would block the calls otherwise.

(() => {
  const PLAYLIST_SCAN_MAX = 150;   // cap on playlists read when gathering suggestions
  // The scan is a burst of requests to ProPresenter, which may be busy running the
  // service on the same PC: run it at most this often (or on the reload button), two
  // requests at a time, and reuse it in between.
  const SUGGEST_TTL_MS = 10 * 60 * 1000;
  const SCAN_PARALLEL = 2;
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
    // back as it was; the exceptions are what its own 400 errors have asked for:
    //   - an empty item id ("" -- headers have one) must be null, not "";
    //   - target_uuid is required on every item ("missing field `target_uuid`");
    //   - presentation_info needs arrangement_name ("missing field
    //     `arrangement_name`"), "" meaning no arrangement.
    // Nothing is ever dropped: leaving out empty fields is what lost them.
    function putBody(items) {
      return JSON.parse(JSON.stringify(items)).map(it => {
        if (it.id && typeof it.id === "object" && !it.id.uuid) it.id.uuid = null;
        if (it.target_uuid === undefined || it.target_uuid === null) it.target_uuid = "";
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

    // A new random (v4) UUID. crypto.randomUUID needs a secure (https) page,
    // which the proxy's http page isn't; getRandomValues works on any page.
    function newUuid() {
      if (crypto.randomUUID && window.isSecureContext) return crypto.randomUUID();
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }

    function itemPresentation(it) {
      return (it.presentation_info || {}).presentation_uuid || it.target_uuid || "";
    }

    async function playlistList() {
      const out = [];
      (function walk(nodes, prefix) {
        for (const n of nodes || []) {
          const id = n.id || {};
          if (n.type === "group") walk(n.playlists, `${prefix}${id.name || ""} / `);
          else if (id.uuid) out.push({ uuid: id.uuid, name: prefix + (id.name || "") });
        }
      })(await getJSON("/v1/playlists"), "");
      return out;
    }

    async function suggestions(playlists) {
      const seen = {};
      const todo = playlists.slice(0, PLAYLIST_SCAN_MAX), lists = [];
      async function worker() {   // a few at a time, so ProPresenter isn't flooded
        while (todo.length) {
          const pl = todo.shift();
          lists.push(await getJSON(`/v1/playlist/${enc(pl.uuid)}`).then(j => (j && j.items) || [], () => []));
        }
      }
      await Promise.all(Array.from({ length: SCAN_PARALLEL }, worker));
      for (const items of lists) {
        for (const it of items) {
          const name = ((it.presentation_info || {}).arrangement_name || "").trim();
          const pres = itemPresentation(it);
          if (name && pres) (seen[pres] = seen[pres] || new Set()).add(name);
        }
      }
      const out = {};
      for (const k in seen) out[k] = [...seen[k]].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return out;
    }

    let suggestCache = null, suggestAt = 0;
    async function cachedSuggestions(fresh) {
      if (fresh || !suggestCache || Date.now() - suggestAt > SUGGEST_TTL_MS) {
        suggestCache = await suggestions(await playlistList());
        suggestAt = Date.now();
      }
      return suggestCache;
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
                      playlist: "", item: "" };
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

      async playlist(id, fresh) {
        const pl = (await getJSON(`/v1/playlist/${enc(id)}`)) || {};
        const sugg = await cachedSuggestions(fresh);
        const items = (pl.items || []).map((it, i) => ({
          index: i,
          name: (it.id || {}).name || "",
          type: it.type || "",
          is_pco: !!it.is_pco,
          arrangement: (it.presentation_info || {}).arrangement_name || "",
          choices: it.type === "presentation" ? (sugg[itemPresentation(it)] || []) : [],
        }));
        return { ok: true, name: (pl.id || {}).name || "", items };
      },

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
      // write it back, read it again to confirm. A write ProPresenter refuses
      // (4xx) changed nothing; one it took that didn't stick is put back. `edit(items)` changes items in place (or throws) and
      // returns kept(after).
      async editPlaylist(id, edit) {
        const path = `/v1/playlist/${enc(id)}`;
        const items = ((await getJSON(path)) || {}).items || [];
        if (items.some(it => it.is_pco))
          throw new Error("This playlist is linked to Planning Center; edit it there.");
        const original = JSON.parse(JSON.stringify(items));
        const kept = edit(items);
        items.forEach((it, i) => { if (it.id && typeof it.id === "object") it.id.index = i; });

        let ok = false;
        try {
          await call("PUT", path, putBody(items), 6000);
          ok = !!kept(((await getJSON(path)) || {}).items || []);
        } catch (e) {
          if (e.refused) throw Object.assign(new Error(`ProPresenter refused the change (${e.message}). Nothing was changed.`), { refused: true });
          ok = false;
        }
        if (ok) return { ok: true };
        try {
          await call("PUT", path, putBody(original), 6000);
        } catch (e) {
          throw new Error(`ProPresenter didn't take the change, and restoring it failed too (${e.message}). Check the playlist in ProPresenter.`);
        }
        throw new Error("ProPresenter didn't take the change; the playlist was put back as it was.");
      },

      async setArrangement(id, index, expectedName, arrangement) {
        arrangement = (arrangement || "").trim().slice(0, 200);
        let pres = "";
        const res = await this.editPlaylist(id, items => {
          checkItem(items, index, expectedName);
          if (items[index].type !== "presentation") throw new Error("Only songs/presentations have arrangements");
          const info = Object.assign({}, items[index].presentation_info || {});
          if (!info.presentation_uuid) info.presentation_uuid = itemPresentation(items[index]);
          info.arrangement_name = arrangement;   // "" = no arrangement (the field must stay)
          items[index].presentation_info = info;
          const n = items.length;
          pres = itemPresentation(items[index]);
          return after => after.length === n &&
            (((after[index] || {}).presentation_info || {}).arrangement_name || "") === arrangement;
        });
        if (suggestCache && pres && arrangement) {   // offer the new name straight away
          const names = new Set(suggestCache[pres] || []);
          names.add(arrangement);
          suggestCache[pres] = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        }
        return res;
      },

      // Add a library presentation to the end of a playlist, shaped like the
      // entries ProPresenter itself returns:
      //   {id:{uuid,name,index}, type:"presentation", is_hidden, is_pco,
      //    presentation_info:{presentation_uuid, arrangement_name, arrangement_uuid},
      //    target_uuid, destination}
      // id.uuid is the entry's own id (not the song's). ProPresenter requires one
      // (null is refused: "expected a string"), so a new one is made here.
      // A new entry has no arrangement id, and it isn't known whether ProPresenter
      // wants that field left out, null or "" (it answered 404 to ""), so each is
      // tried in turn. A refused write changes nothing, so retrying is safe.
      async addToPlaylist(id, uuid, name) {
        if (!uuid) throw new Error("missing presentation");
        name = (name || "").trim().slice(0, 200);
        const NO_ARRANGEMENT = [undefined, null, ""];   // undefined = leave the field out
        let last;
        for (const arr of NO_ARRANGEMENT) {
          try {
            return await this.editPlaylist(id, items => {
              const n = items.length;
              const info = { presentation_uuid: uuid, arrangement_name: "" };
              if (arr !== undefined) info.arrangement_uuid = arr;
              items.push({ id: { uuid: newUuid(), name, index: n }, type: "presentation",
                           is_hidden: false, is_pco: false, presentation_info: info,
                           target_uuid: uuid, destination: "presentation" });
              return after => after.length === n + 1 && itemPresentation(after[n]) === uuid;
            });
          } catch (e) {
            last = e;
            if (!e.refused) throw e;   // not a refusal: something may have changed, stop
          }
        }
        throw last;
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
