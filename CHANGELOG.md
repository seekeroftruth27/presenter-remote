# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- **Adding from a library was refused** ("HTTP 404"). The new playlist entry
  is now built the way ProPresenter builds its own: ProPresenter gives it its
  own id, and no other song's settings are copied in.

### Added
- When ProPresenter refuses a change, the proxy writes what was sent and
  ProPresenter's answer to `pp-proxy-errors.log` beside the exe, for reporting
  problems.

## [v1.1.1] — 2026-10-13

### Changed
- **Macros tab** shows the macros in ProPresenter's **Default** macro
  collection, in its order, instead of a fixed list of names. Edit that
  collection in ProPresenter to change the buttons.

