# Name changes

| Old name | New name | Notes |
|----------|----------|-------|
| Cursor Window Title | Window Title Plugin | Extension display name / user-facing product name (2026-07-25) |
| Cursor Window Title Plugin | Window Title Plugin | Sample title for this repo |
| `window_title.txt` (repo root) | `.env/window_title.txt` | Title file now lives in an `.env` folder |
| `.env` `WINDOW_TITLE=...` file | removed | Replaced by `.env/window_title.txt` |
| `cursor-window-title` | `window-title` | npm / Marketplace extension name (2026-07-25) |
| `cursorWindowTitle.*` | `windowTitle.*` | Commands, settings, and extension state keys (2026-07-25) |
| `.env/cursor_window_title_plugin.code-workspace` | removed | Obsolete managed workspace; use `Window Title Plugin.code-workspace` |
| `cursorWindowTitle.managedWorkspace` | `windowTitle.managedWorkspace` | Managed workspace marker; old key still detected for cleanup |
| `cursor-window-title-*.vsix` | removed | Old package artifacts deleted; new name is `window-title-*.vsix` |
| folder `cursor_window_title_plugin` | `window_title_plugin` | Rename locally when the folder is not open in the editor |
| publisher `matthew-schinkel` | `MatthewSchinkel` | Must match Marketplace publisher ID |
