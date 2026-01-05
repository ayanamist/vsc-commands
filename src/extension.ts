import * as vscode from 'vscode';
import { promises as fs, existsSync } from 'fs';
import * as path from 'path';

type Preset = {
  id: string;
  nickname: string;
  command: string;
  icon?: string;
  enabled?: boolean;
  showInStatusBar?: boolean;
  statusBarColor?: string;
};

const CONFIG_SECTION = 'commands';
const PRESETS_KEY = 'presets';
const STATUS_BAR_PRESETS_KEY = 'statusBarPresets';
const ASSET_FOLDER = '.commands-assets';

function loadPresets(): Preset[] {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return cfg.get<Preset[]>(PRESETS_KEY, []);
}

function loadStatusBarPresetIds(): string[] {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return cfg.get<string[]>(STATUS_BAR_PRESETS_KEY, []);
}

function resolveIcon(
  icon: string | undefined,
  ctx: vscode.ExtensionContext
): vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined {
  if (!icon) return;
  const trimmed = icon.trim();
  if (!trimmed) return;

  if (trimmed.startsWith('codicon:')) {
    return new vscode.ThemeIcon(trimmed.slice('codicon:'.length));
  }

  if (trimmed.startsWith('asset:')) {
    const name = trimmed.slice('asset:'.length);
    const baseName = name.endsWith('.svg') ? name.replace(/\.svg$/, '') : name;
    const lightUri = vscode.Uri.joinPath(ctx.extensionUri, 'media', `${baseName}-light.svg`);
    const darkUri = vscode.Uri.joinPath(ctx.extensionUri, 'media', `${baseName}-dark.svg`);
    if (existsSync(lightUri.fsPath) && existsSync(darkUri.fsPath)) {
      return { light: lightUri, dark: darkUri };
    }
    const fileName = `${baseName}.svg`;
    return vscode.Uri.joinPath(ctx.extensionUri, 'media', fileName);
  }

  if (trimmed.startsWith('file:') || trimmed.startsWith('http:') || trimmed.startsWith('https:')) {
    return vscode.Uri.parse(trimmed);
  }

  return vscode.Uri.parse(trimmed);
}

function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

function getAssetFolderUri(): vscode.Uri | undefined {
  const root = getWorkspaceRoot();
  if (!root) return;
  return vscode.Uri.joinPath(root, ASSET_FOLDER);
}

function isLocalFileIcon(icon: string): boolean {
  if (icon.startsWith('file:')) return true;
  return path.isAbsolute(icon);
}

async function copyIconIfNeeded(icon: string | undefined, presetId: string): Promise<string | undefined> {
  if (!icon) return;
  if (!isLocalFileIcon(icon)) return icon;

  const assetRoot = getAssetFolderUri();
  if (!assetRoot) return icon;

  const srcPath = icon.startsWith('file:')
    ? vscode.Uri.parse(icon).fsPath
    : icon;

  const ext = path.extname(srcPath) || '.svg';
  const safeBase = presetId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'preset';
  const destName = `${safeBase}-${Date.now()}${ext}`;
  const destUri = vscode.Uri.joinPath(assetRoot, destName);

  try {
    await fs.mkdir(assetRoot.fsPath, { recursive: true });
    await fs.copyFile(srcPath, destUri.fsPath);
    return destUri.toString();
  } catch {
    return icon;
  }
}

function getTerminalLocation(): vscode.TerminalLocation | { viewColumn: vscode.ViewColumn; preserveFocus: boolean } {
  const anyVscode = vscode as unknown as { TerminalLocation?: { Editor?: vscode.TerminalLocation } };
  if (anyVscode.TerminalLocation?.Editor !== undefined) {
    return anyVscode.TerminalLocation.Editor as vscode.TerminalLocation;
  }

  return { viewColumn: vscode.ViewColumn.One, preserveFocus: false };
}

function runPreset(preset: Preset, ctx: vscode.ExtensionContext) {
  const term = vscode.window.createTerminal({
    name: preset.nickname,
    iconPath: resolveIcon(preset.icon, ctx),
    location: getTerminalLocation()
  });

  term.sendText(preset.command, true);
  term.show(false);
}

async function setStatusBarFlag(preset: Preset, enabled: boolean) {
  const presets = loadPresets();
  const index = presets.findIndex(p => p.id === preset.id);
  if (index === -1) return;
  const current = presets[index];
  presets[index] = { ...current, showInStatusBar: enabled };
  await vscode.workspace.getConfiguration(CONFIG_SECTION).update(PRESETS_KEY, presets, vscode.ConfigurationTarget.Global);
}

class PresetItem extends vscode.TreeItem {
  constructor(
    public readonly preset: Preset,
    iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri }
  ) {
    super(preset.nickname, vscode.TreeItemCollapsibleState.None);
    this.description = preset.command;
    this.iconPath = iconPath;
    this.contextValue = preset.showInStatusBar === false
      ? 'commandsPresetStatusBarOff'
      : 'commandsPresetStatusBarOn';
    this.command = {
      command: 'commands.runPreset',
      title: 'Run Preset',
      arguments: [preset]
    };
  }
}

class PresetProvider implements vscode.TreeDataProvider<PresetItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<PresetItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private statusBarItems: vscode.StatusBarItem[] = [];

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
    this.refreshStatusBar();
  }

  getTreeItem(element: PresetItem): vscode.TreeItem {
    return element;
  }

  getChildren(): PresetItem[] {
    const presets = loadPresets().filter(p => p.enabled !== false);
    return presets.map(p => new PresetItem(p, resolveIcon(p.icon, this.ctx)));
  }

  refreshStatusBar() {
    for (const item of this.statusBarItems) {
      item.dispose();
    }
    this.statusBarItems = [];

    const presets = loadPresets().filter(p => p.enabled !== false);
    const toShow = presets.filter(p => p.showInStatusBar !== false);

    for (const preset of toShow) {
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      const icon = preset.icon?.startsWith('codicon:')
        ? preset.icon.replace('codicon:', '$(') + ')'
        : '$(terminal)';
      item.text = `${icon} ${preset.nickname}`;
      item.tooltip = `${preset.command}`;
      if (preset.statusBarColor) {
        item.color = preset.statusBarColor;
      }
      item.command = {
        command: 'commands.runPreset',
        title: 'Run Preset',
        arguments: [preset]
      };
      item.show();
      this.statusBarItems.push(item);
      this.ctx.subscriptions.push(item);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new PresetProvider(context);

  context.subscriptions.push(
    vscode.window.createTreeView('commands.presets', { treeDataProvider: provider })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.runPreset', (preset: Preset) => {
      if (!preset) return;
      runPreset(preset, context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.toggleStatusBar', async (item: Preset | PresetItem) => {
      const preset = item instanceof PresetItem ? item.preset : item;
      if (!preset) return;
      await setStatusBarFlag(preset, preset.showInStatusBar === false);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.enableStatusBar', async (item: Preset | PresetItem) => {
      const preset = item instanceof PresetItem ? item.preset : item;
      if (!preset) return;
      await setStatusBarFlag(preset, true);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.disableStatusBar', async (item: Preset | PresetItem) => {
      const preset = item instanceof PresetItem ? item.preset : item;
      if (!preset) return;
      await setStatusBarFlag(preset, false);
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.pickPreset', async () => {
      const presets = loadPresets().filter(p => p.enabled !== false);
      const pick = await vscode.window.showQuickPick(
        presets.map(p => ({ label: p.nickname, description: p.command, preset: p })),
        { placeHolder: 'Run terminal preset' }
      );
      if (!pick) return;
      runPreset(pick.preset, context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.openEditor', () => {
      const panel = vscode.window.createWebviewPanel(
        'commands.editor',
        'Commands Presets',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      panel.webview.html = getEditorHtml(panel.webview, context.extensionUri);

      panel.webview.onDidReceiveMessage(async msg => {
        if (msg?.type === 'requestPresets') {
          panel.webview.postMessage({ type: 'presets', presets: loadPresets() });
        }

        if (msg?.type === 'pickIcon') {
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Images': ['svg', 'png'] }
          });
          if (!picked?.length) return;
          panel.webview.postMessage({ type: 'pickedIcon', rowId: msg.rowId, path: picked[0].fsPath });
        }

        if (msg?.type === 'savePresets') {
          const presets = Array.isArray(msg.presets) ? msg.presets as Preset[] : [];
          const updated: Preset[] = [];
          for (const preset of presets) {
            const icon = await copyIconIfNeeded(preset.icon, preset.id);
            updated.push({ ...preset, icon });
          }
          await vscode.workspace.getConfiguration(CONFIG_SECTION).update(PRESETS_KEY, updated, vscode.ConfigurationTarget.Global);
          provider.refresh();
          panel.webview.postMessage({ type: 'saved' });
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.openSettingsJson', () => {
      return vscode.commands.executeCommand('workbench.action.openSettingsJson');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commands.refreshPresets', () => provider.refresh())
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.${PRESETS_KEY}`)) {
        provider.refresh();
      }
      if (e.affectsConfiguration(`${CONFIG_SECTION}.${STATUS_BAR_PRESETS_KEY}`)) {
        provider.refresh();
      }
    })
  );

  provider.refreshStatusBar();
}

export function deactivate() {}

function getEditorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'editor.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'editor.js'));
  const assetNote = `Assets copied to: ${ASSET_FOLDER} in the workspace root. For theme-aware assets, add name-light.svg and name-dark.svg in media/ and use asset:name.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Commands Presets</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <header>
    <h1>Commands Presets</h1>
    <p class="muted">Use asset:claude, asset:codex, asset:gemini, codicon:terminal, or a local file path. ${assetNote}</p>
  </header>
  <main>
    <div class="actions">
      <button id="add">Add Preset</button>
      <button id="save" class="primary">Save</button>
    </div>
    <div id="list" class="list"></div>
  </main>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
