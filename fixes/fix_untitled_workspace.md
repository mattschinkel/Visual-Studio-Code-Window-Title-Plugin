# Fix: "Untitled (Workspace)" after setting workspace name

Author: Matthew Schinkel

## Problem

To set the workspace name from `.env/window_title.txt`, the extension called
`vscode.workspace.updateWorkspaceFolders(0, 1, { uri, name })` on the first
folder.

In a **single-folder** window there is no `.code-workspace` file. Calling
`updateWorkspaceFolders` in that case forces VS Code to create an
in-memory multi-root workspace, which shows in the status bar and title as
**"Untitled (Workspace)"**. This is a documented VS Code limitation: the folder
of a single-folder window cannot be renamed without converting it to a
workspace.

## Fix

`setWorkspaceFolderName` now only runs when a **saved** multi-root workspace is
open (`vscode.workspace.workspaceFile` exists and has scheme `file`). For
single-folder windows the rename is skipped entirely, so no untitled workspace
is created. The custom title is still applied via `window.title` and the
Open Recent / taskbar jump-list label.

Setting: `windowTitle.updateWorkspaceName` (default `true`) now documents
that it applies to saved multi-root workspaces only.

## Recovering a window already stuck as "Untitled (Workspace)"

The conversion is in-memory and not saved. Reopen the folder to return to a
normal single-folder window:

- File → Open Folder… → select the project folder, or
- File → Open Recent → pick the folder entry (not a workspace entry)

## Version

Fixed in extension version 1.0.6.
