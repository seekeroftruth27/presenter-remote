# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- **Adding from a library was still refused** ("missing field
  `arrangement_name`"): the new item was built with fewer fields than
  ProPresenter requires. It's now shaped like a song already in the playlist,
  every item keeps `arrangement_name` (empty for none), and choosing **No
  arrangement** sets it empty instead of removing it.

## [v1.0.1] — 2026-10-12

### Fixed
- **Adding from a library (and other playlist edits) was refused by
  ProPresenter** with "missing field `target_uuid`": the playlist was written
  back with empty fields left out, and ProPresenter requires that one on every
  item. Every field now goes back as ProPresenter gave it.

