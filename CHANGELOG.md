# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.0.2] — 2026-10-12

### Fixed
- **Adding from a library was still refused** ("missing field
  `arrangement_name`"): the new item was built with fewer fields than
  ProPresenter requires. It's now shaped like a song already in the playlist,
  every item keeps `arrangement_name` (empty for none), and choosing **No
  arrangement** sets it empty instead of removing it.

