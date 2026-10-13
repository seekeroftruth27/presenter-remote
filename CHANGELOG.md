# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Added
- **Version shown** at the bottom of the Macros tab (and ⚙ in the app),
  e.g. "PP Remote v1.1.4".

### Fixed
- **Adding from a library** now works with real ProPresenter: each new entry
  names one of the song's own arrangements (its current one), which
  ProPresenter requires.
- **Choosing an arrangement** now changes the arrangement ProPresenter actually
  uses, not just its name. A name the song doesn't have is reported instead of
  being saved.
- **Macros tab** said there was no "Default" collection: ProPresenter's is
  called **Default Collection**. Either name now works.

## [v1.1.3] — 2026-10-13

### Fixed
- **Adding from a library was still refused** ("invalid type: null, expected a
  string"): ProPresenter needs every playlist entry to carry its own id, so a
  new entry now gets a fresh one.

