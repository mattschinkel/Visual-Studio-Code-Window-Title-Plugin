# Progress — Window Title Plugin

## Highlights & features

- VS Code / Cursor extension that applies a per-project window title on workspace open
- Reads `.env/window_title.txt` (first non-empty line)
- Reads title files over **SSH remotes** via `vscode.workspace.fs`
- Caches titles so Recents/jump-list can update SSH entries when the host is offline
- Watches the title file and re-applies on change
- Sets the bottom-left **workspace label** by creating/opening a managed `{title}.code-workspace` named from `.env/window_title.txt`
- Sets Open Recent / Windows taskbar jump-list **labels** to the same title (`Title [SSH: host]` for remotes)
- Command to refresh recent labels for local + SSH projects
- Command to re-apply title manually
- One-time prompt / command to switch Cursor to native title bar so `window.title` is visible
- MIT open source license; Marketplace metadata points at GitHub repo

## TODOs / pending work

- [x] Install extension into Cursor and confirm title updates (native title bar / Editor mode)
- [x] Show custom titles in taskbar Recents / jump list via recent `label`
- [x] Update remote (SSH) recent labels by reading title files (+ cache fallback)
- [x] Use `.env/window_title.txt` (`.env` folder) as the title file location
- [x] Set workspace folder display name from the title file (multi-root only)
- [x] Fix "Untitled (Workspace)" caused by renaming a single-folder workspace
- [x] Show title in bottom-left workspace label via managed `{title}.code-workspace`
- [x] Add MIT LICENSE and `repository` / `bugs` / `homepage` for Marketplace
- [ ] Confirm bottom-left status bar shows title after 1.0.7 opens the workspace file
- [ ] After reload, confirm jump list shows "Window Title Plugin" instead of folder name
- [ ] Confirm SSH recent labels after opening a remote with `.env/window_title.txt`
- [ ] Optional: support multi-root workspaces (per-folder titles)
- [ ] Optional: add a 128×128 PNG `icon` in `package.json` for Marketplace listing
- [x] Push initial source to https://github.com/mattschinkel/Visual-Studio-Code-Window-Title-Plugin.git
- [ ] Create Marketplace publisher `matthew-schinkel` and publish first release
- [ ] Confirm window title is visible after reload (use native title bar if custom bar ignores it)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run compile` | Compile TypeScript to `out/` |
| `npm run watch` | Watch-compile TypeScript |
| `npm run package` | Build `.vsix` via `@vscode/vsce` |
| `npm run publish:marketplace` | Publish to Visual Studio Marketplace via vsce |

## Previous issues

- `fixes/fix_untitled_workspace.md` — Renaming the folder of a single-folder window via `updateWorkspaceFolders` turned it into "Untitled (Workspace)"; fixed by only renaming in saved workspaces.
- `fixes/fix_workspace_status_label.md` — Bottom-left "Current workspace" showed the folder basename; fixed in 1.0.7 by creating/opening a managed `{title}.code-workspace` named from `.env/window_title.txt`.
