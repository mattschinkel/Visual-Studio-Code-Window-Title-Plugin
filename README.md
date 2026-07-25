# Window Title Plugin

Sets the VS Code **window title** from a per-project file when you open a workspace.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Visual Studio Marketplace](https://img.shields.io/badge/Marketplace-install-007ACC?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=MatthewSchinkel.window-title)

## Title file

Put the title in:

```text
.vscode/window_title.txt
```

Use the first non-empty line as the window title, workspace folder name, and Recents label.

Example:

```text
My Project Name
```

## Install

### Development (F5)

1. `npm install`
2. `npm run compile`
3. Open this folder in VS Code, then **Run and Debug → Run Extension**

### Install as VSIX

```powershell
npm install
npm run compile
npx vsce package --no-dependencies
```

In VS Code: **Extensions → … → Install from VSIX…** and pick the generated `.vsix`.

### Marketplace

Search **Window Title Plugin** in the Extensions view, or open:

https://marketplace.visualstudio.com/items?itemName=MatthewSchinkel.window-title

## Title bar note

Some editors use a custom title bar that ignores `window.title`. Use:

```json
"window.titleBarStyle": "native"
```

The extension offers this once on first activation, or run command **Window Title: Prefer Native Title Bar**. Restart the editor after changing the title bar style.

## Commands

| Command | Action |
|---------|--------|
| Window Title: Apply from .vscode/window_title.txt | Re-read the title file and set `window.title` + recent label |
| Window Title: Refresh Recent / Jump List Labels | Scan recent projects and set labels from their title files |
| Window Title: Prefer Native Title Bar | Set `window.titleBarStyle` to `native` |

## Recent / taskbar jump list

On open, the extension also sets the workspace **recent label** (used by **Open Recent** and the Windows taskbar **Recent Folders** jump list) to the same project title.

Works for **local** and **SSH remote** folders:

- Reads `.vscode/window_title.txt` through the VS Code file API (including over SSH when that remote is open)
- Caches each project title so Recents can still be updated when the SSH host is not currently connected
- SSH labels look like `My Title [SSH: proxmox]`

For older projects already in Recents, run **Window Title: Refresh Recent / Jump List Labels**. Open each SSH project at least once (with a title file present) so the cache can be filled.

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `windowTitle.titleFile` | `.vscode/window_title.txt` | Title file path |
| `windowTitle.titleTemplate` | `${customTitle}` | Written to `window.title` |
| `windowTitle.watchFiles` | `true` | Re-apply on file change |
| `windowTitle.updateRecentLabel` | `true` | Update Recents / jump-list labels |
| `windowTitle.updateWorkspaceName` | `true` | Create/open `{title}.code-workspace` so the bottom-left workspace label matches the title |

> The bottom-left **Current workspace** label comes from the `.code-workspace` file name (or the folder basename if you only opened a folder). With `updateWorkspaceName` enabled, the extension writes a managed `{title}.code-workspace` and opens it so that label shows your title from `.vscode/window_title.txt` — without creating an "Untitled (Workspace)".

## License

MIT © [Matthew Schinkel](https://github.com/mattschinkel) — see [LICENSE](LICENSE).

## Repository

https://github.com/mattschinkel/Visual-Studio-Code-Window-Title-Plugin
