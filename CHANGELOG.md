# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.3.3] — 2026-10-14

### Fixed
- The proxy window no longer fills with an error ("'Handler' object has no
  attribute 'path'") when something connects that isn't plain HTTP, for example
  a browser trying `https://`. It now prints one line saying the request was
  ignored. Those requests never reached ProPresenter either way.

