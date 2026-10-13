# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- **Macros tab** said there was no "Default" collection: ProPresenter's is
  called **Default Collection**. Either name now works.

## [v1.1.3] — 2026-10-13

### Fixed
- **Adding from a library was still refused** ("invalid type: null, expected a
  string"): ProPresenter needs every playlist entry to carry its own id, so a
  new entry now gets a fresh one.

