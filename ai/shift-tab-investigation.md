# Shift+Tab Keyboard Interception Issue in Terminal Editor

## The Extension
**Commands: Open Terminal in Editor** - A VS Code/Cursor extension that opens terminal presets in the editor area (not the bottom panel) via status bar buttons.

Repository: https://github.com/danielraffel/Commands

## The Problem

When a terminal is opened in the **editor area** (not the integrated terminal panel at the bottom), pressing **Shift+Tab** causes two things to happen simultaneously:

1. **Desired behavior**: The Shift+Tab keypress IS being sent to the terminal (e.g., Claude Code REPL receives it and cycles through modes)
2. **Undesired behavior**: Cursor's accessibility/UI navigation ALSO fires, moving focus to GUI elements (status bar icons, tabs, etc.)

This is a **dual-action problem** - both behaviors execute on the same keypress.

### Important Context
- The terminal runs **Claude Code** (a CLI REPL tool)
- Shift+Tab is used within Claude Code to cycle through input modes
- The issue does NOT occur in:
  - The integrated terminal panel (bottom)
  - Running Claude Code in a standalone terminal outside Cursor
- The issue ONLY occurs when the terminal is opened in the editor area

### Visual Example
When pressing Shift+Tab in Claude Code running in an editor-area terminal:
- Claude Code receives the keypress and cycles modes ✓
- BUT focus also jumps to UI elements like the Cursor extension icon in the toolbar ✗

## Technical Details

### How the Extension Opens Terminals in Editor Area

```typescript
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
    location: getTerminalLocation(),  // Opens in editor area
    env: { [COMMANDS_TERMINAL_ENV]: '1' }
  });
  term.sendText(preset.command, true);
  term.show(false);
}
```

### Current Keybinding Approach

```json
"keybindings": [
  {
    "key": "shift+tab",
    "command": "commands.sendShiftTab",
    "when": "terminalFocus"
  }
]
```

The command sends the escape sequence for Shift+Tab:
```typescript
function sendShiftTabSequence() {
  const active = vscode.window.activeTerminal;
  if (!active) return;

  const sequence = '\u001b[Z';  // Standard xterm Shift+Tab escape sequence
  void vscode.commands.executeCommand('workbench.action.terminal.sendSequence', { text: sequence });

  // Attempted workaround: refocus terminal after delay
  setTimeout(() => {
    void vscode.commands.executeCommand('workbench.action.terminal.focus');
  }, 50);
}
```

## What We've Tried

### 1. Negative Keybindings to Disable Default Behaviors
Added negative keybindings (prefixed with `-`) to disable VS Code's default Shift+Tab commands:

```json
{
  "key": "shift+tab",
  "command": "-editor.action.outdentLines",
  "when": "terminalEditorFocus"
},
{
  "key": "shift+tab",
  "command": "-workbench.action.terminal.focusPreviousPane",
  "when": "terminalEditorFocus"
},
{
  "key": "shift+tab",
  "command": "-workbench.action.navigateBack",
  "when": "terminalEditorFocus"
},
{
  "key": "shift+tab",
  "command": "-workbench.action.focusPreviousPart",
  "when": "terminalEditorFocus"
},
{
  "key": "shift+tab",
  "command": "-workbench.action.terminal.focusAccessibilityView",
  "when": "terminalEditorFocus"
}
```

**Result**: No effect. The accessibility navigation still fires.

### 2. Various When-Clause Conditions
Tried different combinations:
- `terminalFocus` - basic terminal focus
- `terminalEditorFocus` - terminal in editor area focus
- `terminalFocusInAny` - any terminal focus
- `commands.commandsTerminalFocus` - custom context for extension-created terminals
- `config.commands.sendShiftTabToTerminal` - config flag

**Result**: The keybinding DOES fire (confirmed via popup notification and logging), but default behavior still executes.

### 3. Immediate Terminal Refocus
Added `workbench.action.terminal.focus` immediately after sending the sequence.

**Result**: No effect - the accessibility navigation fires after our refocus.

### 4. Delayed Terminal Refocus (50ms)
Added setTimeout to refocus after Cursor's navigation completes.

**Result**: No effect - focus still escapes to GUI elements.

### 5. Simplified Testing
Removed all conditions, used just `"when": "terminalFocus"` and showed a notification to confirm the keybinding fires.

**Result**: Confirmed keybinding fires, but dual-action still occurs.

## Root Cause Analysis

The accessibility tab navigation in Cursor/VS Code appears to operate at a **lower level than the keybinding system** - possibly at the Electron/browser DOM level. This means:

1. Extension keybindings CAN intercept the keypress and execute commands
2. BUT they CANNOT prevent the native browser tab navigation from also firing
3. Negative keybindings only remove VS Code keybindings, not native browser behavior

## Potential Solutions to Explore

1. **Cursor/VS Code Setting**: Is there a setting to disable accessibility tab navigation for terminals?
   - `editor.tabFocusMode`?
   - `terminal.integrated.tabFocusMode`?
   - Accessibility settings?

2. **Different API**: Is there a way to capture keyboard events at a lower level in VS Code extensions?

3. **Terminal Options**: Are there terminal creation options that affect keyboard handling?

4. **Focus Trapping**: Can the terminal editor be configured to trap focus and prevent tab navigation?

5. **Cursor-Specific**: Is this a Cursor-specific issue? Does it behave differently in standard VS Code?

## Environment

- **Editor**: Cursor (VS Code fork)
- **Extension**: Commands: Open Terminal in Editor v0.0.3
- **VS Code Engine**: ^1.95.0
- **Platform**: macOS (Darwin 25.2.0)

## Files of Interest

- `src/extension.ts` - Main extension logic
- `package.json` - Keybindings and configuration
- Key functions:
  - `getTerminalLocation()` - Lines 139-146
  - `runPreset()` - Lines 148-160
  - `sendShiftTabSequence()` - Lines 60-77
  - `updateActiveTerminalContext()` - Lines 48-53

## Questions for Review

1. Is there a way to prevent native browser tab navigation from firing when a VS Code extension keybinding handles the keypress?

2. Are there terminal-specific APIs that provide better keyboard control when the terminal is in the editor area?

3. Is this a known limitation of terminals in the editor area vs the integrated terminal panel?

4. Would a different approach (like a custom editor or webview-based terminal) avoid this issue?

5. Are there Cursor-specific settings or APIs that could help?
