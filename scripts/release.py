#!/usr/bin/env python3
"""Cut a PP Remote release: bump VERSION, turn the CHANGELOG's Unreleased section
into the new version's section, run the quick checks, commit, and tag vX.Y.Z.

    python scripts/release.py [patch|minor|major|X.Y.Z] [--push] [--dry-run]

Pushing the tag (with --push, or `git push origin main vX.Y.Z` yourself) starts
the "Build Windows proxy" workflow, which builds pp-remote-proxy.exe and
publishes a GitHub Release for the tag with the exe attached and this version's
CHANGELOG section as the notes.

Refuses to run on a dirty tree, off the default branch, behind origin, with an
empty Unreleased section, or when a check fails. Standard library only.
"""

import argparse
import datetime
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
BRANCH = "main"


def git(*args, check=True):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return r.stdout.strip()


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def write(path, text):
    with open(os.path.join(ROOT, path), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def next_version(current, level):
    if re.fullmatch(r"\d+\.\d+\.\d+", level):
        return level
    major, minor, patch = (int(x) for x in current.split("."))
    if level == "major":
        return f"{major + 1}.0.0"
    if level == "minor":
        return f"{major}.{minor + 1}.0"
    if level == "patch":
        return f"{major}.{minor}.{patch + 1}"
    sys.exit(f"unknown level {level!r}: use patch, minor, major or X.Y.Z")


def roll_changelog(text, version, date):
    """Rename '## [Unreleased]' to the version and open a fresh, empty one."""
    m = re.search(r"^## \[Unreleased\]\s*\n(.*?)(?=^## \[|\Z)", text, re.S | re.M)
    if not m or not m.group(1).strip():
        sys.exit("CHANGELOG.md has nothing under '## [Unreleased]'. Describe the changes first.")
    head = f"## [Unreleased]\n\n## [v{version}] — {date}\n"
    return text[:m.start()] + head + "\n" + m.group(1).lstrip("\n"), m.group(1).strip()


def checks():
    """The quick checks a contributor runs: syntax, and the proxy serving the page."""
    subprocess.run([sys.executable, "-m", "py_compile", "proxy/pp_proxy.py"], cwd=ROOT, check=True)
    try:
        subprocess.run(["node", "--check", "web/pp.js"], cwd=ROOT, check=True)
    except FileNotFoundError:
        print("  (node not found: skipped the pp.js syntax check)")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    proc = subprocess.Popen([sys.executable, "proxy/pp_proxy.py", "127.0.0.1:9", "--port", str(port)],
                            cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            try:
                page = urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read().decode()
                break
            except OSError:
                time.sleep(0.2)
        else:
            sys.exit("check failed: the proxy didn't start")
        if "PP Remote" not in page:
            sys.exit("check failed: the proxy didn't serve the page")
    finally:
        proc.terminate()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("level", nargs="?", default="patch")
    ap.add_argument("--push", action="store_true", help="push main and the tag (starts the release build)")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen, change nothing")
    args = ap.parse_args()

    if git("status", "--porcelain"):
        sys.exit("The working tree has uncommitted changes. Commit or stash them first.")
    if git("rev-parse", "--abbrev-ref", "HEAD") != BRANCH:
        sys.exit(f"Releases are cut from {BRANCH}. Merge your branch and check out {BRANCH} first.")
    git("fetch", "-q", "origin", BRANCH, "--tags")
    if git("rev-list", "--count", f"HEAD..origin/{BRANCH}") != "0":
        sys.exit(f"{BRANCH} is behind origin. Pull first.")

    current = read("VERSION").strip()
    version = next_version(current, args.level)
    tag = f"v{version}"
    if git("tag", "-l", tag):
        sys.exit(f"Tag {tag} already exists.")
    date = datetime.date.today().isoformat()
    changelog, notes = roll_changelog(read("CHANGELOG.md"), version, date)

    print(f"Release {current} -> {version} ({tag}), {date}\n\n{notes}\n")
    if args.dry_run:
        print("(dry run: nothing changed)")
        return

    print("Checks…")
    checks()
    write("VERSION", version + "\n")
    write("CHANGELOG.md", changelog)
    git("add", "VERSION", "CHANGELOG.md")
    git("commit", "-q", "-m", f"Release {tag}")
    git("tag", "-a", tag, "-m", f"PP Remote {tag}")
    print(f"Committed and tagged {tag}.")
    if args.push:
        git("push", "-q", "origin", BRANCH, tag)
        print(f"Pushed. The 'Build Windows proxy' workflow is building the {tag} release.")
    else:
        print(f"Push to publish:  git push origin {BRANCH} {tag}")


if __name__ == "__main__":
    main()
