# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.0.1] — 2026-10-12

### Fixed
- **Adding from a library (and other playlist edits) was refused by
  ProPresenter** with "missing field `target_uuid`": the playlist was written
  back with empty fields left out, and ProPresenter requires that one on every
  item. Every field now goes back as ProPresenter gave it.

