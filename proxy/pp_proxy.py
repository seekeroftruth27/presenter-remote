#!/usr/bin/env python3
"""PP Remote proxy: serves the remote page to phone browsers and forwards its
ProPresenter API calls.

Only needed for using the remote in a phone's browser. A browser page can't call
ProPresenter's network API directly because the API sends no CORS headers; this
proxy serves the page and forwards /v1/... to ProPresenter from the same origin,
so the browser never sees a cross-origin request. (The iPhone app calls
ProPresenter itself and needs no proxy.)

Standard library only. Run it on any computer on the same network as
ProPresenter, usually the ProPresenter computer itself:

    python pp_proxy.py 192.168.1.50:1025          # ProPresenter's address
    python pp_proxy.py 192.168.1.50:1025 --port 8080

With no address it asks once and remembers the answer in pp-proxy.txt next to
the script (or the .exe). Then open http://<this-computer's-ip>:8080 on a phone.

Only paths under /v1/ are forwarded, and only to the one ProPresenter address
it was given, so it can't be used to reach anything else on the network.

Read-only by default: only GET requests reach ProPresenter (showing slides,
triggering items and macros are all GETs). Writes (PUT/POST/DELETE: playlist
editing) are refused here unless the proxy is started with
--allow-playlist-edits. Every write, refused or passed on, is recorded in
pp-proxy-changes.log beside the exe.
"""

import argparse
import datetime
import mimetypes
import os
import socket
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

TIMEOUT = 20  # seconds per ProPresenter request (a playlist save can be slow)
MAX_BODY = 2 * 1024 * 1024  # a whole playlist PUT is far smaller than this
ERROR_LOG = "pp-proxy-errors.log"   # next to the exe: writes ProPresenter refused
ERROR_LOG_MAX = 512 * 1024          # start the log afresh past this size
CHANGES_LOG = "pp-proxy-changes.log"   # every write: blocked, passed on, and the answer


def _here():
    """Folder of the script, or of the .exe when frozen by PyInstaller."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def _web_dir():
    """The bundled page: inside the .exe when frozen, else ../web."""
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "web")  # type: ignore[attr-defined]
    return os.path.join(_here(), os.pardir, "web")


def _version():
    """The release version (VERSION file; bundled into the .exe)."""
    base = sys._MEIPASS if getattr(sys, "frozen", False) else os.path.join(_here(), os.pardir)  # type: ignore[attr-defined]
    try:
        with open(os.path.join(base, "VERSION"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return "dev"


def _normalize(addr):
    addr = (addr or "").strip().rstrip("/")
    if addr and "://" not in addr:
        addr = "http://" + addr
    parts = urlsplit(addr)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError(f"not a ProPresenter address: {addr!r}")
    return f"{parts.scheme}://{parts.netloc}"


def _lan_ip():
    """This computer's address on the local network, for the 'open this' hint."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # no packet is sent
            return s.getsockname()[0]
    except OSError:
        return "this-computer"


class Handler(BaseHTTPRequestHandler):
    pp = ""        # ProPresenter base URL, set at startup
    allow_writes = False   # --allow-playlist-edits
    web = ""       # folder holding index.html and pp.js
    server_version = "PPRemoteProxy"

    def log_message(self, fmt, *args):  # quieter than the default
        path = getattr(self, "path", None)
        if path is None:   # not a readable HTTP request (e.g. https:// to this http port)
            sys.stderr.write("Ignored a request from %s that isn't plain HTTP "
                             "(open the page with http://, not https://)\n" % self.client_address[0])
        elif not path.startswith("/v1/"):
            sys.stderr.write("%s %s\n" % (getattr(self, "command", "?"), path))

    # -- the page ------------------------------------------------------------
    def _static(self):
        name = urlsplit(self.path).path.lstrip("/") or "index.html"
        if name == "MODE":   # tells the page whether editing controls may be shown
            mode = b"edit" if self.allow_writes else b"read-only"
            return self._send(200, mode, "text/plain; charset=utf-8", cache="no-cache")
        if name == "VERSION":   # shown on the page, so it's clear which release runs
            return self._send(200, _version().encode(), "text/plain; charset=utf-8", cache="no-cache")
        if "/" in name or name.startswith("."):
            return self._send(404, b"not found", "text/plain")
        path = os.path.join(self.web, name)
        if not os.path.isfile(path):
            return self._send(404, b"not found", "text/plain")
        with open(path, "rb") as f:
            body = f.read()
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self._send(200, body, ctype, cache="no-cache")

    # -- ProPresenter --------------------------------------------------------
    def _forward(self):
        path = self.path
        if not path.startswith("/v1/") or ".." in path:
            return self._send(404, b"not found", "text/plain")
        body = None
        if self.command in ("PUT", "POST", "DELETE"):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self._send(413, b"too large", "text/plain")
            body = self.rfile.read(length)
            if not self.allow_writes:   # read-only: nothing that changes ProPresenter's data
                self._log_change(path, "BLOCKED (read-only proxy)", body)
                return self._send(403, b"Playlist editing is turned off on this PP Remote proxy.",
                                  "text/plain", cache="no-store")
        req = urllib.request.Request(self.pp + path, data=body, method=self.command)
        req.add_header("Accept", self.headers.get("Accept") or "application/json")
        if body is not None:
            req.add_header("Content-Type", self.headers.get("Content-Type") or "application/json")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                answer = r.read()
                if body is not None:
                    self._log_change(path, f"sent -> HTTP {r.status}", body)
                self._send(r.status, answer, r.headers.get("Content-Type") or "",
                           cache="no-store")
        except urllib.error.HTTPError as e:   # pass ProPresenter's answer through
            answer = e.read()
            if body is not None:
                self._log_change(path, f"sent -> HTTP {e.code} (refused)", body)
                self._log_refusal(path, e.code, answer, body)
            self._send(e.code, answer, e.headers.get("Content-Type") or "text/plain",
                       cache="no-store")
        except Exception as e:                # unreachable, timed out, ...
            self._send(502, f"Can't reach ProPresenter at {self.pp}: {e}".encode(),
                       "text/plain", cache="no-store")

    def _log_change(self, path, outcome, sent):
        """Record a write (blocked or passed on) with what it carried, so any change
        ProPresenter received can be traced afterwards."""
        log = os.path.join(_here(), CHANGES_LOG)
        try:
            mode = "w" if os.path.isfile(log) and os.path.getsize(log) > ERROR_LOG_MAX else "a"
            with open(log, mode, encoding="utf-8") as f:
                f.write(f"=== {datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {self.command} {path}  {outcome}"
                        f"  from {self.client_address[0]}\n")
                f.write("Body: " + sent.decode("utf-8", "replace") + "\n\n")
            print(f"{self.command} {path}: {outcome}")
        except OSError:
            pass

    def _log_refusal(self, path, code, answer, sent):
        """Keep a write ProPresenter refused (what was sent, what came back), so a
        refusal can be diagnosed from the log instead of guessed at."""
        log = os.path.join(_here(), ERROR_LOG)
        try:
            mode = "w" if os.path.isfile(log) and os.path.getsize(log) > ERROR_LOG_MAX else "a"
            with open(log, mode, encoding="utf-8") as f:
                f.write(f"=== {datetime.datetime.now():%Y-%m-%d %H:%M:%S}  {self.command} {path}"
                        f"  -> HTTP {code}\n")
                f.write("ProPresenter said: " + (answer.decode("utf-8", "replace").strip() or "(nothing)") + "\n")
                f.write("Sent: " + sent.decode("utf-8", "replace") + "\n\n")
            print(f"ProPresenter refused {self.command} {path} (HTTP {code}); details in {ERROR_LOG}")
        except OSError:
            pass

    def _send(self, code, body, ctype, cache=None):
        self.send_response(code)
        if ctype:
            self.send_header("Content-Type", ctype)
        if cache:
            self.send_header("Cache-Control", cache)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/v1/"):
            self._forward()
        else:
            self._static()

    def do_HEAD(self):
        self.do_GET()

    def do_PUT(self):
        self._forward()

    def do_POST(self):
        self._forward()

    def do_DELETE(self):
        self._forward()


class Server(ThreadingHTTPServer):
    # http.server turns on SO_REUSEADDR, which on Windows lets a second proxy
    # bind a port another one already holds, with no error: the new window
    # looks fine while the old copy keeps answering. Claim the port exclusively.
    if os.name == "nt":
        allow_reuse_address = False

        def server_bind(self):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()


def main():
    ap = argparse.ArgumentParser(description="Serve the PP Remote page and forward its ProPresenter calls.")
    ap.add_argument("propresenter", nargs="?", help="ProPresenter's address, e.g. 192.168.1.50:1025 "
                    "(ProPresenter: Settings > Network)")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PP_PROXY_PORT", "8080")))
    ap.add_argument("--allow-playlist-edits", action="store_true",
                    help="let the page change playlists (add, remove, reorder, arrangements). "
                         "Off by default: the proxy then passes on only GET requests.")
    args = ap.parse_args()
    Handler.allow_writes = args.allow_playlist_edits

    saved = os.path.join(_here(), "pp-proxy.txt")
    addr = args.propresenter or os.environ.get("PP_URL")
    if not addr and os.path.isfile(saved):
        with open(saved, encoding="utf-8-sig") as f:
            addr = f.read().strip()
    if not addr:
        print("ProPresenter's address is under Settings > Network in ProPresenter.")
        addr = input("ProPresenter address (e.g. 192.168.1.50:1025): ")
    try:
        Handler.pp = _normalize(addr)
    except ValueError as e:
        sys.exit(str(e))
    if not args.propresenter:
        try:
            with open(saved, "w", encoding="utf-8") as f:
                f.write(Handler.pp + "\n")
        except OSError:
            pass
    Handler.web = os.path.abspath(_web_dir())
    if not os.path.isfile(os.path.join(Handler.web, "index.html")):
        sys.exit(f"remote page not found in {Handler.web}")

    try:
        httpd = Server(("0.0.0.0", args.port), Handler)
    except OSError as e:
        print(f"Port {args.port} is already in use ({e.strerror}). Is PP Remote proxy already "
              "running? Close the other copy (or use --port) and start this again.")
        if getattr(sys, "frozen", False):
            input("Press Enter to close.")
        sys.exit(1)
    print(f"PP Remote proxy v{_version()}")
    print(f"ProPresenter: {Handler.pp}")
    if Handler.allow_writes:
        print(f"PLAYLIST EDITING IS ON: every change is recorded in {CHANGES_LOG}.")
    else:
        print("Read-only: playlists can't be changed from the remote "
              "(start with --allow-playlist-edits to allow it).")
    print(f"On a phone on the same Wi-Fi, open:  http://{_lan_ip()}:{args.port}")
    print("(Ctrl+C to stop.)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
