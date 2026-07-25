# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-07-25

### Changed

- Renamed extension id from `cursor-window-title` to `window-title`
- Renamed commands and settings from `cursorWindowTitle.*` to `windowTitle.*`
- Removed Cursor-specific branding from docs and user-facing messages

## [1.0.7] - 2026-07-25

### Added

- Managed `{title}.code-workspace` so the bottom-left workspace label matches `.env/window_title.txt`
- Open source MIT license and Marketplace-ready package metadata

### Fixed

- Avoided "Untitled (Workspace)" caused by renaming a single-folder window

## [1.0.0] - 2026-07-25

### Added

- Apply `window.title` from `.env/window_title.txt` on workspace open
- Watch title file and re-apply on change
- Recents / Windows jump-list labels (local and SSH, with offline cache)
- Commands to apply title, refresh recent labels, and prefer native title bar
