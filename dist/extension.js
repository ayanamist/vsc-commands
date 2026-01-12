"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const CONFIG_SECTION = 'commands';
const PRESETS_KEY = 'presets';
const STATUS_BAR_PRESETS_KEY = 'statusBarPresets';
const COMMAND_SETS_KEY = 'commandSets';
const COMMAND_SET_FOCUS_FIRST_KEY = 'commandSetFocusFirst';
const SHIFT_TAB_SEQUENCE_KEY = 'shiftTabSequence';
const ASSET_FOLDER = '.commands-assets';
const COMMANDS_TERMINAL_CONTEXT = 'commands.commandsTerminalFocus';
const COMMANDS_TERMINAL_ENV = 'COMMANDS_TERMINAL';
const managedTerminals = new Set();
// Track if we've shown the accessibility warning this session
let accessibilityWarningShown = false;
function isCommandsTerminal(terminal) {
    if (!terminal)
        return false;
    if (managedTerminals.has(terminal))
        return true;
    const creationOptions = terminal.creationOptions;
    if ('env' in creationOptions) {
        const env = creationOptions.env;
        return Boolean(env && env[COMMANDS_TERMINAL_ENV] === '1');
    }
    return false;
}
async function updateActiveTerminalContext() {
    const active = vscode.window.activeTerminal;
    const isCommands = isCommandsTerminal(active);
    void vscode.commands.executeCommand('setContext', COMMANDS_TERMINAL_CONTEXT, isCommands);
    // When a Commands terminal gets focus, configure settings to prevent
    // Shift+Tab from triggering accessibility navigation
    if (isCommands) {
        const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');
        const editorConfig = vscode.workspace.getConfiguration('editor');
        // Set terminal tab focus mode to false
        if (terminalConfig.get('tabFocusMode') !== false) {
            await terminalConfig.update('tabFocusMode', false, vscode.ConfigurationTarget.Global);
        }
        // Set editor tab focus mode to false
        if (editorConfig.get('tabFocusMode') !== false) {
            await editorConfig.update('tabFocusMode', false, vscode.ConfigurationTarget.Global);
        }
        // Set accessibility support to off for terminal
        if (terminalConfig.get('accessibilitySupport') !== 'off') {
            await terminalConfig.update('accessibilitySupport', 'off', vscode.ConfigurationTarget.Global);
        }
        // Send keybindings directly to shell instead of letting workbench handle them
        if (terminalConfig.get('sendKeybindingsToShell') !== true) {
            await terminalConfig.update('sendKeybindingsToShell', true, vscode.ConfigurationTarget.Global);
        }
        // Check if screen reader mode is enabled - it interferes with Shift+Tab
        if (editorConfig.get('accessibilitySupport') !== 'off' && !accessibilityWarningShown) {
            accessibilityWarningShown = true;
            const result = await vscode.window.showWarningMessage('Screen Reader mode may intercept Shift+Tab in terminals. Disable it for better terminal keybinding support?', 'Disable', 'Ignore');
            if (result === 'Disable') {
                await editorConfig.update('accessibilitySupport', 'off', vscode.ConfigurationTarget.Global);
            }
        }
    }
}
function getShiftTabSequence() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return cfg.get(SHIFT_TAB_SEQUENCE_KEY, '\u001b[Z');
}
function sendShiftTabSequence() {
    const active = vscode.window.activeTerminal;
    if (!active)
        return;
    const sequence = getShiftTabSequence();
    void vscode.commands.executeCommand('workbench.action.terminal.sendSequence', { text: sequence });
}
function loadPresets() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return cfg.get(PRESETS_KEY, []);
}
function loadStatusBarPresetIds() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return cfg.get(STATUS_BAR_PRESETS_KEY, []);
}
function loadCommandSets() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return cfg.get(COMMAND_SETS_KEY, []);
}
function getCommandSetFocusFirst() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return cfg.get(COMMAND_SET_FOCUS_FIRST_KEY, true);
}
function getCommandSetDisplayName(set, presets) {
    if (set.name && set.name.trim()) {
        return set.name.trim();
    }
    // Auto-generate from preset nicknames
    const names = set.presetIds
        .map(id => { var _a; return (_a = presets.find(p => p.id === id)) === null || _a === void 0 ? void 0 : _a.nickname; })
        .filter(Boolean);
    return names.join(' | ') || 'Unnamed Set';
}
function resolveIcon(icon, ctx) {
    if (!icon)
        return;
    const trimmed = icon.trim();
    if (!trimmed)
        return;
    if (trimmed.startsWith('codicon:')) {
        return new vscode.ThemeIcon(trimmed.slice('codicon:'.length));
    }
    if (trimmed.startsWith('asset:')) {
        const name = trimmed.slice('asset:'.length);
        const baseName = name.endsWith('.svg') ? name.replace(/\.svg$/, '') : name;
        const lightUri = vscode.Uri.joinPath(ctx.extensionUri, 'media', `${baseName}-light.svg`);
        const darkUri = vscode.Uri.joinPath(ctx.extensionUri, 'media', `${baseName}-dark.svg`);
        if ((0, fs_1.existsSync)(lightUri.fsPath) && (0, fs_1.existsSync)(darkUri.fsPath)) {
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
function getWorkspaceRoot() {
    var _a, _b;
    return (_b = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.uri;
}
function getAssetFolderUri() {
    const root = getWorkspaceRoot();
    if (!root)
        return;
    return vscode.Uri.joinPath(root, ASSET_FOLDER);
}
function isLocalFileIcon(icon) {
    if (icon.startsWith('file:'))
        return true;
    return path.isAbsolute(icon);
}
async function copyIconIfNeeded(icon, presetId) {
    if (!icon)
        return;
    if (!isLocalFileIcon(icon))
        return icon;
    const assetRoot = getAssetFolderUri();
    if (!assetRoot)
        return icon;
    const srcPath = icon.startsWith('file:')
        ? vscode.Uri.parse(icon).fsPath
        : icon;
    const ext = path.extname(srcPath) || '.svg';
    const safeBase = presetId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'preset';
    const destName = `${safeBase}-${Date.now()}${ext}`;
    const destUri = vscode.Uri.joinPath(assetRoot, destName);
    try {
        await fs_1.promises.mkdir(assetRoot.fsPath, { recursive: true });
        await fs_1.promises.copyFile(srcPath, destUri.fsPath);
        return destUri.toString();
    }
    catch {
        return icon;
    }
}
function getTerminalLocation() {
    var _a;
    const anyVscode = vscode;
    if (((_a = anyVscode.TerminalLocation) === null || _a === void 0 ? void 0 : _a.Editor) !== undefined) {
        return anyVscode.TerminalLocation.Editor;
    }
    return { viewColumn: vscode.ViewColumn.One, preserveFocus: false };
}
function runPreset(preset, ctx) {
    const term = vscode.window.createTerminal({
        name: preset.nickname,
        iconPath: resolveIcon(preset.icon, ctx),
        location: getTerminalLocation(),
        env: { [COMMANDS_TERMINAL_ENV]: '1' }
    });
    term.sendText(preset.command, true);
    term.show(false);
    managedTerminals.add(term);
    updateActiveTerminalContext();
}
async function setStatusBarFlag(preset, enabled) {
    const presets = loadPresets();
    const index = presets.findIndex(p => p.id === preset.id);
    if (index === -1)
        return;
    const current = presets[index];
    presets[index] = { ...current, showInStatusBar: enabled };
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update(PRESETS_KEY, presets, vscode.ConfigurationTarget.Global);
}
class PresetItem extends vscode.TreeItem {
    constructor(preset, iconPath) {
        super(preset.nickname, vscode.TreeItemCollapsibleState.None);
        this.preset = preset;
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
class PresetProvider {
    constructor(ctx) {
        this.ctx = ctx;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.statusBarItems = [];
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
        this.refreshStatusBar();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        const presets = loadPresets().filter(p => p.enabled !== false);
        return presets.map(p => new PresetItem(p, resolveIcon(p.icon, this.ctx)));
    }
    refreshStatusBar() {
        var _a;
        for (const item of this.statusBarItems) {
            item.dispose();
        }
        this.statusBarItems = [];
        const presets = loadPresets().filter(p => p.enabled !== false);
        const toShow = presets.filter(p => p.showInStatusBar !== false);
        // Individual preset buttons
        for (const preset of toShow) {
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            const icon = ((_a = preset.icon) === null || _a === void 0 ? void 0 : _a.startsWith('codicon:'))
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
        // Command Set buttons
        const allPresets = loadPresets();
        const commandSets = loadCommandSets().filter(s => s.enabled !== false && s.showInStatusBar !== false);
        for (const set of commandSets) {
            const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
            const displayName = getCommandSetDisplayName(set, allPresets);
            item.text = `$(list-unordered) ${displayName}`;
            const presetNames = set.presetIds
                .map(id => { var _a; return (_a = allPresets.find(p => p.id === id)) === null || _a === void 0 ? void 0 : _a.nickname; })
                .filter(Boolean)
                .join(', ');
            item.tooltip = `Launch: ${presetNames}`;
            item.command = {
                command: 'commands.runCommandSet',
                title: 'Run Command Set',
                arguments: [set]
            };
            item.show();
            this.statusBarItems.push(item);
            this.ctx.subscriptions.push(item);
        }
    }
}
function activate(context) {
    const provider = new PresetProvider(context);
    context.subscriptions.push(vscode.window.createTreeView('commands.presets', { treeDataProvider: provider }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.runPreset', (preset) => {
        if (!preset)
            return;
        runPreset(preset, context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.runCommandSet', async (set) => {
        var _a;
        if (!set || !((_a = set.presetIds) === null || _a === void 0 ? void 0 : _a.length))
            return;
        const allPresets = loadPresets();
        const focusFirst = getCommandSetFocusFirst();
        const presetsToRun = set.presetIds
            .map(id => allPresets.find(p => p.id === id))
            .filter((p) => p !== undefined && p.enabled !== false);
        if (presetsToRun.length === 0)
            return;
        // Run all presets
        for (const preset of presetsToRun) {
            runPreset(preset, context);
        }
        // Focus the appropriate terminal (first or last based on setting)
        // Small delay to ensure terminals are created
        setTimeout(() => {
            const terminals = vscode.window.terminals;
            if (terminals.length > 0) {
                const targetIndex = focusFirst ? terminals.length - presetsToRun.length : terminals.length - 1;
                const terminalToFocus = terminals[Math.max(0, targetIndex)];
                if (terminalToFocus) {
                    terminalToFocus.show();
                }
            }
        }, 100);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.enableStatusBar', async (item) => {
        const preset = item instanceof PresetItem ? item.preset : item;
        if (!preset)
            return;
        await setStatusBarFlag(preset, true);
        provider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.disableStatusBar', async (item) => {
        const preset = item instanceof PresetItem ? item.preset : item;
        if (!preset)
            return;
        await setStatusBarFlag(preset, false);
        provider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.pickPreset', async () => {
        const presets = loadPresets().filter(p => p.enabled !== false);
        const pick = await vscode.window.showQuickPick(presets.map(p => ({ label: p.nickname, description: p.command, preset: p })), { placeHolder: 'Run terminal preset' });
        if (!pick)
            return;
        runPreset(pick.preset, context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.openEditor', () => {
        const panel = vscode.window.createWebviewPanel('commands.editor', 'Commands Presets', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
        panel.webview.html = getEditorHtml(panel.webview, context.extensionUri);
        panel.webview.onDidReceiveMessage(async (msg) => {
            if ((msg === null || msg === void 0 ? void 0 : msg.type) === 'requestPresets') {
                panel.webview.postMessage({
                    type: 'presets',
                    presets: loadPresets(),
                    commandSets: loadCommandSets(),
                    focusFirst: getCommandSetFocusFirst()
                });
            }
            if ((msg === null || msg === void 0 ? void 0 : msg.type) === 'pickIcon') {
                const picked = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: { 'Images': ['svg', 'png'] }
                });
                if (!(picked === null || picked === void 0 ? void 0 : picked.length))
                    return;
                panel.webview.postMessage({ type: 'pickedIcon', rowId: msg.rowId, path: picked[0].fsPath });
            }
            if ((msg === null || msg === void 0 ? void 0 : msg.type) === 'savePresets') {
                const presets = Array.isArray(msg.presets) ? msg.presets : [];
                const updated = [];
                for (const preset of presets) {
                    const icon = await copyIconIfNeeded(preset.icon, preset.id);
                    updated.push({ ...preset, icon });
                }
                const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
                await cfg.update(PRESETS_KEY, updated, vscode.ConfigurationTarget.Global);
                // Save command sets if provided
                if (msg.commandSets !== undefined) {
                    const sets = Array.isArray(msg.commandSets) ? msg.commandSets : [];
                    await cfg.update(COMMAND_SETS_KEY, sets, vscode.ConfigurationTarget.Global);
                }
                // Save focus first setting if provided
                if (msg.focusFirst !== undefined) {
                    await cfg.update(COMMAND_SET_FOCUS_FIRST_KEY, msg.focusFirst, vscode.ConfigurationTarget.Global);
                }
                provider.refresh();
                panel.webview.postMessage({ type: 'saved' });
            }
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.openSettingsJson', () => {
        return vscode.commands.executeCommand('workbench.action.openSettingsJson');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('commands.refreshPresets', () => provider.refresh()));
    context.subscriptions.push(vscode.commands.registerCommand('commands.sendShiftTab', () => sendShiftTabSequence()));
    context.subscriptions.push(vscode.window.onDidChangeActiveTerminal(() => updateActiveTerminalContext()));
    context.subscriptions.push(vscode.window.onDidCloseTerminal(term => {
        if (managedTerminals.delete(term)) {
            updateActiveTerminalContext();
        }
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(`${CONFIG_SECTION}.${PRESETS_KEY}`)) {
            provider.refresh();
        }
        if (e.affectsConfiguration(`${CONFIG_SECTION}.${STATUS_BAR_PRESETS_KEY}`)) {
            provider.refresh();
        }
        if (e.affectsConfiguration(`${CONFIG_SECTION}.${COMMAND_SETS_KEY}`)) {
            provider.refresh();
        }
    }));
    provider.refreshStatusBar();
    updateActiveTerminalContext();
}
function deactivate() { }
function getEditorHtml(webview, extensionUri) {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'editor.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'editor.js'));
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Commands Presets</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="saveBanner" class="save-banner hidden">
    <span>You have unsaved changes</span>
    <button id="bannerSave" class="primary">Save</button>
    <button id="bannerDismiss" class="dismiss">×</button>
  </div>
  <header>
    <h1>Terminal Presets</h1>
    <p class="muted">Create shortcuts that open terminals with specific commands. Each preset appears in the activity bar and optionally in the status bar.</p>
  </header>
  <main>
    <div class="actions">
      <button id="add">Add Preset</button>
      <button id="save" class="primary">Save</button>
    </div>
    <div id="list" class="list"></div>
  </main>
  <section class="command-sets-section">
    <h2>Command Sets</h2>
    <p class="muted">Launch multiple presets with one click from the status bar. Command Sets don't appear in the activity bar.</p>
    <div class="actions">
      <button id="addSet">Add Set</button>
    </div>
    <div id="setList" class="list"></div>
    <label class="focus-setting">
      <input type="checkbox" id="focusFirst" checked />
      <span>Focus the first preset when launching a set</span>
      <span class="muted">(uncheck to focus the last preset instead)</span>
    </label>
  </section>
  <div class="editor-settings">
    <label>
      <input type="checkbox" id="showSaveReminder" checked />
      <span>Show save reminder when changes are made</span>
    </label>
  </div>
  <footer class="cli-links">
    <p><strong>Get the CLIs:</strong></p>
    <ul>
      <li><a href="https://docs.anthropic.com/en/docs/claude-code/overview">Claude Code</a></li>
      <li><a href="https://developers.openai.com/codex/cli/">OpenAI Codex</a></li>
      <li><a href="https://geminicli.com">Google Gemini</a></li>
      <li><a href="https://cursor.com/docs/cli/installation">Cursor Agent</a></li>
      <li><a href="https://ampcode.com/manual#getting-started-command-line-interface">Amp</a></li>
      <li><a href="https://opencode.ai">OpenCode</a></li>
    </ul>
    <p><strong>Get browser extensions:</strong></p>
    <ul>
      <li><a href="https://code.claude.com/docs/en/chrome">Claude for Chrome</a></li>
    </ul>
  </footer>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map