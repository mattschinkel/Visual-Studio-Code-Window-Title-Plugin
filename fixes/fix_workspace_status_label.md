# Fix: bottom-left workspace label shows folder name instead of title

Author: Matthew Schinkel

## Problem

The status-bar item **"Current workspace: …"** does not use `window.title`.

- Single-folder window → folder basename (e.g. `my_project`)
- Saved `.code-workspace` → basename of that file (without `.code-workspace`)
- Calling `updateWorkspaceFolders` to rename a single-folder window → **"Untitled (Workspace)"**

So neither `window.title` nor a folder rename alone can put `.env/window_title.txt` into that bottom-left label for a normal folder open.

## Fix (v1.0.7)

When `windowTitle.updateWorkspaceName` is true:

1. Write a **managed** workspace file at the project root named after the title, e.g. `Window Title Plugin.code-workspace`
2. Mark it with `"windowTitle.managedWorkspace": true` in its settings
3. If the window is still a single-folder open (or an older managed workspace), open that file with `vscode.openFolder` / `forceReuseWindow`
4. Remove other managed `*.code-workspace` files left from previous titles

The bottom-left label then shows the title because it matches the workspace file name. Explorer folder name is also set inside the workspace file.

## Version

Introduced in extension version 1.0.7.
