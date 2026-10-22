# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- The big picture on the Remote tab now looks like the stage screen: the live
  slide's lyrics in large bold capitals on black, a band in the next slide's group
  colour naming that group, and the next slide's lyrics below it. (ProPresenter only gives a
  picture of the stage layout's template, not of the live stage screen.)

## [v1.3.13] — 2026-10-21

### Changed
- Remote tab, new layout: "LIVE · Slide n of N" and the slide's group now sit under
  the arrangement; the live slide's picture fills the width (the text beside it is
  gone); the song's slides are a carousel along the bottom, five across, with the
  live one in the middle. Scrolling it doesn't change the slide, and it re-centres
  when the slide changes. The slide-size slider is gone.
- The big picture on the Remote tab shows the stage screen (the layout on
  ProPresenter's first stage screen) when ProPresenter provides that picture, and
  the audience picture otherwise. The carousel keeps the audience pictures.
- Playlist tab: the slide preview shows three slides per row, and tapping
  anywhere in an open preview closes it, like tapping the title.
- "Add from library": the Library list, Done and Search are the same height, with
  larger text.

