# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.1.6] — 2026-10-13

### Fixed
- **A new proxy could start while an old one was still running** and quietly
  get none of the traffic, so the phone kept using the old version. Now the
  second copy says the port is already in use and doesn't start.

