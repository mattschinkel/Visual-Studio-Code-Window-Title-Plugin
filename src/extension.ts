import * as vscode from "vscode";

const EXTENSION_NAME = "Window Title Plugin";
const TITLE_CACHE_KEY = "windowTitle.titleCache";
const DEFAULT_TITLE_FILE = ".env/window_title.txt";
const MANAGED_WORKSPACE_SETTING = "windowTitle.managedWorkspace";
/** Pre-1.0.8 setting key; still recognized so old managed workspaces can be cleaned up. */
const LEGACY_MANAGED_WORKSPACE_SETTING = "cursorWindowTitle.managedWorkspace";

interface RecentWorkspaceEntry {
  folderUri?: vscode.Uri;
  workspace?: { id: string; configPath: vscode.Uri };
  label?: string;
  remoteAuthority?: string;
}

interface RecentlyOpened {
  workspaces?: RecentWorkspaceEntry[];
  files?: unknown[];
}

type TitleCache = Record<string, string>;

interface ManagedWorkspaceFile {
  folders: Array<{ name: string; path: string }>;
  settings: Record<string, unknown>;
}

let extensionContext: vscode.ExtensionContext | undefined;

function getConfig() {
  return vscode.workspace.getConfiguration("windowTitle");
}

function titleFileRelativePath(): string {
  return getConfig().get<string>("titleFile", DEFAULT_TITLE_FILE);
}

function currentWorkspaceRootUri(): vscode.Uri | undefined {
  const workspaceFile = vscode.workspace.workspaceFile;
  if (workspaceFile && workspaceFile.scheme !== "untitled") {
    return vscode.Uri.joinPath(workspaceFile, "..");
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function firstNonEmptyLine(text: string): string | undefined {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

async function readTextFile(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return undefined;
  }
}

async function readTitleFromRootUri(
  rootUri: vscode.Uri
): Promise<string | undefined> {
  const titleText = await readTextFile(
    vscode.Uri.joinPath(rootUri, titleFileRelativePath())
  );
  return titleText ? firstNonEmptyLine(titleText) : undefined;
}

function buildWindowTitle(customTitle: string): string {
  const template = getConfig().get<string>("titleTemplate", "${customTitle}");
  if (!template || template.trim().length === 0) {
    return customTitle;
  }
  return template.replace(/\$\{customTitle\}/g, customTitle);
}

function getRemoteAuthority(uri?: vscode.Uri): string | undefined {
  if (uri?.scheme === "vscode-remote") {
    return uri.authority;
  }
  const remoteAuthority = (vscode.env as { remoteAuthority?: string })
    .remoteAuthority;
  return remoteAuthority || undefined;
}

function sshHostFromAuthority(remoteAuthority?: string): string | undefined {
  if (!remoteAuthority) {
    return undefined;
  }

  const prefix = "ssh-remote+";
  if (!remoteAuthority.startsWith(prefix)) {
    return undefined;
  }

  const encoded = remoteAuthority.slice(prefix.length);
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      hostName?: string;
      host?: string;
    };
    return parsed.hostName || parsed.host;
  } catch {
    return encoded || undefined;
  }
}

function recentLabelForTitle(
  customTitle: string,
  remoteAuthority?: string
): string {
  const host = sshHostFromAuthority(remoteAuthority);
  if (host) {
    return `${customTitle} [SSH: ${host}]`;
  }
  return customTitle;
}

function cacheKeyForUri(uri: vscode.Uri): string {
  return uri.toString();
}

function readTitleCache(): TitleCache {
  return extensionContext?.globalState.get<TitleCache>(TITLE_CACHE_KEY, {}) ?? {};
}

async function writeCachedTitle(
  uri: vscode.Uri,
  customTitle: string
): Promise<void> {
  if (!extensionContext) {
    return;
  }
  const cache = { ...readTitleCache(), [cacheKeyForUri(uri)]: customTitle };
  await extensionContext.globalState.update(TITLE_CACHE_KEY, cache);
}

function getCachedTitle(uri: vscode.Uri): string | undefined {
  return readTitleCache()[cacheKeyForUri(uri)];
}

async function resolveTitleForRootUri(
  rootUri: vscode.Uri
): Promise<string | undefined> {
  const live = await readTitleFromRootUri(rootUri);
  if (live) {
    await writeCachedTitle(rootUri, live);
    return live;
  }
  return getCachedTitle(rootUri);
}

function sanitizeWorkspaceFileBaseName(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "workspace";
}

function sameUri(a: vscode.Uri, b: vscode.Uri): boolean {
  return a.toString().toLowerCase() === b.toString().toLowerCase();
}

function buildManagedWorkspaceContent(customTitle: string): ManagedWorkspaceFile {
  return {
    folders: [
      {
        name: customTitle,
        path: ".",
      },
    ],
    settings: {
      [MANAGED_WORKSPACE_SETTING]: true,
      "window.title": customTitle,
    },
  };
}

async function isManagedWorkspaceFile(uri: vscode.Uri): Promise<boolean> {
  const text = await readTextFile(uri);
  if (!text) {
    return false;
  }
  try {
    const parsed = JSON.parse(text) as ManagedWorkspaceFile;
    const settings = parsed?.settings;
    return (
      settings?.[MANAGED_WORKSPACE_SETTING] === true ||
      settings?.[LEGACY_MANAGED_WORKSPACE_SETTING] === true
    );
  } catch {
    return false;
  }
}

async function cleanupOldManagedWorkspaces(
  rootUri: vscode.Uri,
  keepFileName: string
): Promise<void> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(rootUri);
  } catch {
    return;
  }

  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File) {
      continue;
    }
    if (!name.toLowerCase().endsWith(".code-workspace")) {
      continue;
    }
    if (name === keepFileName) {
      continue;
    }
    const candidate = vscode.Uri.joinPath(rootUri, name);
    if (await isManagedWorkspaceFile(candidate)) {
      try {
        await vscode.workspace.fs.delete(candidate);
      } catch (error) {
        console.warn(
          `${EXTENSION_NAME}: failed deleting old managed workspace ${name}`,
          error
        );
      }
    }
  }
}

/**
 * VS Code shows the bottom-left workspace label from the .code-workspace
 * file name (or the folder basename for single-folder windows). Create/open a
 * managed workspace file named after the title so that label matches.
 *
 * @returns true if a reopen was requested (window will reload)
 */
async function ensureNamedWorkspace(
  rootUri: vscode.Uri,
  customTitle: string
): Promise<boolean> {
  if (!getConfig().get<boolean>("updateWorkspaceName", true)) {
    return false;
  }

  const baseName = sanitizeWorkspaceFileBaseName(customTitle);
  const workspaceFileName = `${baseName}.code-workspace`;
  const targetUri = vscode.Uri.joinPath(rootUri, workspaceFileName);
  const payload = Buffer.from(
    JSON.stringify(buildManagedWorkspaceContent(customTitle), null, 2),
    "utf8"
  );

  await vscode.workspace.fs.writeFile(targetUri, payload);
  await cleanupOldManagedWorkspaces(rootUri, workspaceFileName);

  const current = vscode.workspace.workspaceFile;

  // Already in the correctly named saved workspace.
  if (
    current &&
    current.scheme !== "untitled" &&
    sameUri(current, targetUri)
  ) {
    await setWorkspaceFolderName(customTitle);
    return false;
  }

  // In one of our older managed workspaces (title changed) — switch to the new file.
  if (current && current.scheme !== "untitled") {
    if (await isManagedWorkspaceFile(current)) {
      await vscode.commands.executeCommand("vscode.openFolder", targetUri, {
        forceReuseWindow: true,
      });
      return true;
    }
    // User's own multi-root workspace: only rename the folder display name.
    await setWorkspaceFolderName(customTitle);
    return false;
  }

  // Single-folder window: open the named workspace so the status bar shows the title.
  await vscode.commands.executeCommand("vscode.openFolder", targetUri, {
    forceReuseWindow: true,
  });
  return true;
}

async function setRecentLabelForCurrentWorkspace(
  customTitle: string
): Promise<void> {
  if (!getConfig().get<boolean>("updateRecentLabel", true)) {
    return;
  }

  const workspaceFile = vscode.workspace.workspaceFile;
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFile && !folder) {
    return;
  }

  const targetUri = workspaceFile ?? folder!.uri;
  const remoteAuthority = getRemoteAuthority(targetUri);
  const label = recentLabelForTitle(customTitle, remoteAuthority);

  try {
    if (workspaceFile && workspaceFile.scheme !== "untitled") {
      await writeCachedTitle(
        vscode.Uri.joinPath(workspaceFile, ".."),
        customTitle
      );
      await vscode.commands.executeCommand("_workbench.addToRecentlyOpened", {
        uri: workspaceFile,
        type: "workspace",
        label,
        remoteAuthority,
      });
      return;
    }

    if (folder) {
      await writeCachedTitle(folder.uri, customTitle);
      await vscode.commands.executeCommand("_workbench.addToRecentlyOpened", {
        uri: folder.uri,
        type: "folder",
        label,
        remoteAuthority,
      });
    }
  } catch (error) {
    console.warn(`${EXTENSION_NAME}: failed to update recent label`, error);
  }
}

async function setRecentLabelForFolderUri(
  folderUri: vscode.Uri,
  customTitle: string,
  remoteAuthority?: string
): Promise<void> {
  await writeCachedTitle(folderUri, customTitle);
  await vscode.commands.executeCommand("_workbench.addToRecentlyOpened", {
    uri: folderUri,
    type: "folder",
    label: recentLabelForTitle(customTitle, remoteAuthority),
    remoteAuthority,
  });
}

async function setRecentLabelForWorkspaceUri(
  workspaceConfigUri: vscode.Uri,
  customTitle: string,
  remoteAuthority?: string
): Promise<void> {
  await writeCachedTitle(
    vscode.Uri.joinPath(workspaceConfigUri, ".."),
    customTitle
  );
  await vscode.commands.executeCommand("_workbench.addToRecentlyOpened", {
    uri: workspaceConfigUri,
    type: "workspace",
    label: recentLabelForTitle(customTitle, remoteAuthority),
    remoteAuthority,
  });
}

function isSavedWorkspace(): boolean {
  const workspaceFile = vscode.workspace.workspaceFile;
  return !!workspaceFile && workspaceFile.scheme !== "untitled";
}

async function setWorkspaceFolderName(customTitle: string): Promise<void> {
  if (!getConfig().get<boolean>("updateWorkspaceName", true)) {
    return;
  }

  // Only rename folders inside a saved workspace. Doing this in a single-folder
  // window converts it into an in-memory "Untitled (Workspace)".
  if (!isSavedWorkspace()) {
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder || folder.name === customTitle) {
    return;
  }

  const updated = vscode.workspace.updateWorkspaceFolders(folder.index, 1, {
    uri: folder.uri,
    name: customTitle,
  });

  if (!updated) {
    console.warn(
      `${EXTENSION_NAME}: updateWorkspaceFolders returned false when setting name`
    );
  }
}

async function ensureNativeTitleBarIfNeeded(): Promise<void> {
  const windowConfig = vscode.workspace.getConfiguration("window");
  const style = windowConfig.get<string>("titleBarStyle");
  if (style === "native") {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    `${EXTENSION_NAME}: Some editors use a custom title bar that ignores window.title. Switch to the native title bar so your project title is visible?`,
    "Use Native Title Bar",
    "Not Now"
  );

  if (choice === "Use Native Title Bar") {
    await windowConfig.update(
      "titleBarStyle",
      "native",
      vscode.ConfigurationTarget.Global
    );
    vscode.window.showInformationMessage(
      `${EXTENSION_NAME}: Set window.titleBarStyle to native. Restart the editor for the title bar change to take effect.`
    );
  }
}

async function applyWindowTitle(showStatus = false): Promise<void> {
  const rootUri = currentWorkspaceRootUri();
  if (!rootUri) {
    if (showStatus) {
      vscode.window.showWarningMessage(
        `${EXTENSION_NAME}: No workspace folder is open.`
      );
    }
    return;
  }

  const customTitle = await resolveTitleForRootUri(rootUri);

  if (!customTitle) {
    if (showStatus) {
      vscode.window.showWarningMessage(
        `${EXTENSION_NAME}: No title found. Add ${titleFileRelativePath()} (first non-empty line is the window title).`
      );
    }
    return;
  }

  // Make the bottom-left workspace label match the title via a named .code-workspace.
  const reopening = await ensureNamedWorkspace(rootUri, customTitle);
  if (reopening) {
    return;
  }

  const title = buildWindowTitle(customTitle);
  const windowConfig = vscode.workspace.getConfiguration("window");
  const current = windowConfig.get<string>("title");

  if (current !== title) {
    await windowConfig.update(
      "title",
      title,
      vscode.ConfigurationTarget.Workspace
    );
  }

  await setWorkspaceFolderName(customTitle);
  await setRecentLabelForCurrentWorkspace(customTitle);

  if (showStatus) {
    vscode.window.showInformationMessage(
      `${EXTENSION_NAME}: Window title and workspace name set to "${customTitle}".`
    );
  }
}

function isSupportedRecentUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file" || uri.scheme === "vscode-remote";
}

async function refreshRecentLabelsFromProjects(
  showStatus = false
): Promise<void> {
  if (!getConfig().get<boolean>("updateRecentLabel", true)) {
    if (showStatus) {
      vscode.window.showWarningMessage(
        `${EXTENSION_NAME}: windowTitle.updateRecentLabel is disabled.`
      );
    }
    return;
  }

  let recent: RecentlyOpened | undefined;
  try {
    recent = (await vscode.commands.executeCommand(
      "_workbench.getRecentlyOpened"
    )) as RecentlyOpened;
  } catch (error) {
    console.warn(`${EXTENSION_NAME}: getRecentlyOpened failed`, error);
    if (showStatus) {
      vscode.window.showErrorMessage(
        `${EXTENSION_NAME}: Could not read recently opened list.`
      );
    }
    return;
  }

  const workspaces = recent?.workspaces ?? [];
  let updated = 0;
  let fromCache = 0;
  let skippedRemote = 0;
  const titlePath = titleFileRelativePath();

  // Re-add in reverse so the original MRU order is preserved (each add moves to front).
  for (let i = workspaces.length - 1; i >= 0; i--) {
    const entry = workspaces[i];
    try {
      if (entry.folderUri && isSupportedRecentUri(entry.folderUri)) {
        const live = await readTitleFromRootUri(entry.folderUri);
        const title = live ?? getCachedTitle(entry.folderUri);
        if (!title) {
          if (entry.folderUri.scheme === "vscode-remote") {
            skippedRemote++;
          }
          continue;
        }
        if (!live) {
          fromCache++;
        }
        await setRecentLabelForFolderUri(
          entry.folderUri,
          title,
          entry.remoteAuthority ?? getRemoteAuthority(entry.folderUri)
        );
        updated++;
        continue;
      }

      if (
        entry.workspace?.configPath &&
        isSupportedRecentUri(entry.workspace.configPath)
      ) {
        const rootUri = vscode.Uri.joinPath(entry.workspace.configPath, "..");
        const live = await readTitleFromRootUri(rootUri);
        const title = live ?? getCachedTitle(rootUri);
        if (!title) {
          if (entry.workspace.configPath.scheme === "vscode-remote") {
            skippedRemote++;
          }
          continue;
        }
        if (!live) {
          fromCache++;
        }
        await setRecentLabelForWorkspaceUri(
          entry.workspace.configPath,
          title,
          entry.remoteAuthority ??
            getRemoteAuthority(entry.workspace.configPath)
        );
        updated++;
      }
    } catch (error) {
      console.warn(`${EXTENSION_NAME}: failed updating a recent entry`, error);
    }
  }

  // Ensure the current workspace stays most recent with the right label.
  await applyWindowTitle(false);

  if (showStatus) {
    const parts = [`Updated ${updated} recent project label(s)`];
    if (fromCache > 0) {
      parts.push(`${fromCache} from cache`);
    }
    if (skippedRemote > 0) {
      parts.push(
        `${skippedRemote} SSH skipped (open that remote once, or add ${titlePath} there)`
      );
    }
    vscode.window.showInformationMessage(
      `${EXTENSION_NAME}: ${parts.join("; ")}.`
    );
  }
}

function watchTitleSources(context: vscode.ExtensionContext): void {
  if (!getConfig().get<boolean>("watchFiles", true)) {
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }

  const titleFileRel = titleFileRelativePath();
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(folder, titleFileRel)
  );

  const refresh = () => {
    void applyWindowTitle(false);
  };

  watcher.onDidChange(refresh);
  watcher.onDidCreate(refresh);
  watcher.onDidDelete(refresh);
  context.subscriptions.push(watcher);
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  extensionContext = context;

  context.subscriptions.push(
    vscode.commands.registerCommand("windowTitle.apply", () =>
      applyWindowTitle(true)
    ),
    vscode.commands.registerCommand(
      "windowTitle.refreshRecentLabels",
      () => refreshRecentLabelsFromProjects(true)
    ),
    vscode.commands.registerCommand(
      "windowTitle.useNativeTitleBar",
      async () => {
        await vscode.workspace
          .getConfiguration("window")
          .update("titleBarStyle", "native", vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          `${EXTENSION_NAME}: Set window.titleBarStyle to native. Restart the editor for the change to take effect.`
        );
      }
    )
  );

  watchTitleSources(context);
  await applyWindowTitle(false);

  const promptedKey = "windowTitle.nativeTitleBarPrompted";
  if (!context.globalState.get(promptedKey)) {
    await ensureNativeTitleBarIfNeeded();
    await context.globalState.update(promptedKey, true);
  }
}

export function deactivate(): void {
  extensionContext = undefined;
}
