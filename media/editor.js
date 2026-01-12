const vscode = acquireVsCodeApi();

const list = document.getElementById('list');
const addBtn = document.getElementById('add');
const saveBtn = document.getElementById('save');
const setList = document.getElementById('setList');
const addSetBtn = document.getElementById('addSet');
const focusFirstCheckbox = document.getElementById('focusFirst');

// Add tooltips to header buttons
addBtn.title = 'Add a new terminal preset';
saveBtn.title = 'Save all presets and command sets to settings';
addSetBtn.title = 'Add a new command set';

let presets = [];
let commandSets = [];
let focusFirst = true;
let dragIndex = null;

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createInput(value, placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function render() {
  list.innerHTML = '';
  presets.forEach((preset, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;

    const header = document.createElement('div');
    header.className = 'card-header';

    const grip = document.createElement('div');
    grip.className = 'grip';
    grip.textContent = '≡';
    grip.title = 'Drag to reorder';

    const reorder = document.createElement('div');
    reorder.className = 'reorder';
    const upBtn = document.createElement('button');
    upBtn.textContent = 'Up';
    upBtn.title = 'Move up in list order (affects activity bar and status bar order)';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index === 0) return;
      const item = presets.splice(index, 1)[0];
      presets.splice(index - 1, 0, item);
      render();
    });
    const downBtn = document.createElement('button');
    downBtn.textContent = 'Down';
    downBtn.title = 'Move down in list order (affects activity bar and status bar order)';
    downBtn.disabled = index === presets.length - 1;
    downBtn.addEventListener('click', () => {
      if (index === presets.length - 1) return;
      const item = presets.splice(index, 1)[0];
      presets.splice(index + 1, 0, item);
      render();
    });
    reorder.append(upBtn, downBtn);

    header.append(grip, reorder);

    card.addEventListener('dragstart', (event) => {
      dragIndex = index;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });

    card.addEventListener('dragend', () => {
      dragIndex = null;
      card.classList.remove('dragging');
      Array.from(list.children).forEach(child => child.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const fromIndex = dragIndex ?? Number(event.dataTransfer.getData('text/plain'));
      const toIndex = index;
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
      const item = presets.splice(fromIndex, 1)[0];
      presets.splice(toIndex, 0, item);
      render();
    });

    const row1 = document.createElement('div');
    row1.className = 'row';

    const idLabel = document.createElement('div');
    idLabel.className = 'label';
    idLabel.textContent = 'Id';
    idLabel.title = 'Unique identifier for this preset (auto-generated from nickname if blank)';
    const idInput = createInput(preset.id, 'auto-generated');
    idInput.title = 'Unique identifier for this preset';

    const nameLabel = document.createElement('div');
    nameLabel.className = 'label';
    nameLabel.textContent = 'Nickname';
    nameLabel.title = 'Display name shown in the activity bar and status bar';
    const nameInput = createInput(preset.nickname, 'My Terminal');
    nameInput.title = 'Display name shown in the activity bar and status bar';

    row1.append(idLabel, idInput, nameLabel, nameInput);

    const row2 = document.createElement('div');
    row2.className = 'row';

    const cmdLabel = document.createElement('div');
    cmdLabel.className = 'label';
    cmdLabel.textContent = 'Command';
    cmdLabel.title = 'Shell command to run when the terminal opens';
    const cmdInput = createInput(preset.command, 'e.g. claude, npm start');
    cmdInput.title = 'Shell command to run when the terminal opens';

    const iconLabel = document.createElement('div');
    iconLabel.className = 'label';
    iconLabel.textContent = 'Icon';
    iconLabel.title = 'Icon for the terminal tab. Use asset:name, codicon:name, or choose a file';
    const iconWrap = document.createElement('div');
    iconWrap.className = 'inline';
    const iconInput = createInput(preset.icon, 'asset:claude or codicon:terminal');
    iconInput.title = 'Built-in: asset:claude, asset:codex, asset:gemini, codicon:terminal. Or choose a file.';
    const pickBtn = document.createElement('button');
    pickBtn.textContent = 'Choose file';
    pickBtn.title = 'Select a custom icon file (SVG or PNG)';
    pickBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'pickIcon', rowId: index });
    });
    iconWrap.append(iconInput, pickBtn);

    row2.append(cmdLabel, cmdInput, iconLabel, iconWrap);

    const row3 = document.createElement('div');
    row3.className = 'row';

    const statusLabel = document.createElement('div');
    statusLabel.className = 'label';
    statusLabel.textContent = 'Status bar';
    statusLabel.title = 'Show a quick-launch button in the bottom status bar';
    const statusWrap = document.createElement('div');
    statusWrap.className = 'inline';
    const statusInput = document.createElement('input');
    statusInput.type = 'checkbox';
    statusInput.checked = preset.showInStatusBar !== false;
    statusInput.title = 'Show a quick-launch button in the bottom status bar';
    const statusText = document.createElement('span');
    statusText.className = 'small';
    statusText.textContent = 'Show button';
    statusWrap.append(statusInput, statusText);

    const colorLabel = document.createElement('div');
    colorLabel.className = 'label';
    colorLabel.textContent = 'Button text color';
    colorLabel.title = 'Custom color for the status bar button text';
    const colorInput = createInput(preset.statusBarColor, '#ff6600 or orange');
    colorInput.title = 'CSS color for the button text (e.g. #ff6600, orange)';

    row3.append(statusLabel, statusWrap, colorLabel, colorInput);

    const footer = document.createElement('div');
    footer.className = 'footer';

    const enabledWrap = document.createElement('label');
    enabledWrap.className = 'small';
    enabledWrap.title = 'When disabled, this preset is hidden from the activity bar and status bar';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = preset.enabled !== false;
    enabledInput.title = 'When disabled, this preset is hidden from the activity bar and status bar';
    enabledWrap.append(enabledInput, document.createTextNode(' Enabled'));

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete this preset';
    removeBtn.addEventListener('click', () => {
      presets.splice(index, 1);
      render();
    });

    footer.append(enabledWrap, removeBtn);

    card.append(header, row1, row2, row3, footer);

    card.__inputs = { idInput, nameInput, cmdInput, iconInput, enabledInput, statusInput, colorInput };
    list.append(card);
  });
}

function readPresetsFromDom() {
  return Array.from(list.children).map(card => {
    const { idInput, nameInput, cmdInput, iconInput, enabledInput, statusInput, colorInput } = card.__inputs;
    const nickname = nameInput.value.trim();
    const id = idInput.value.trim() || slugify(nickname) || `preset-${Date.now()}`;
    return {
      id,
      nickname: nickname || id,
      command: cmdInput.value.trim(),
      icon: iconInput.value.trim(),
      enabled: enabledInput.checked,
      showInStatusBar: statusInput.checked,
      statusBarColor: colorInput.value.trim()
    };
  }).filter(p => p.command);
}

function getPresetNickname(presetId) {
  const preset = presets.find(p => p.id === presetId);
  return preset?.nickname || presetId;
}

function renderSets() {
  setList.innerHTML = '';
  commandSets.forEach((set, index) => {
    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const grip = document.createElement('div');
    grip.className = 'grip';
    grip.textContent = '≡';
    grip.title = 'Drag to reorder';

    const reorder = document.createElement('div');
    reorder.className = 'reorder';
    const upBtn = document.createElement('button');
    upBtn.textContent = 'Up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index === 0) return;
      const item = commandSets.splice(index, 1)[0];
      commandSets.splice(index - 1, 0, item);
      renderSets();
    });
    const downBtn = document.createElement('button');
    downBtn.textContent = 'Down';
    downBtn.disabled = index === commandSets.length - 1;
    downBtn.addEventListener('click', () => {
      if (index === commandSets.length - 1) return;
      const item = commandSets.splice(index, 1)[0];
      commandSets.splice(index + 1, 0, item);
      renderSets();
    });
    reorder.append(upBtn, downBtn);
    header.append(grip, reorder);

    // Name row
    const nameRow = document.createElement('div');
    nameRow.className = 'row';
    const nameLabel = document.createElement('div');
    nameLabel.className = 'label';
    nameLabel.textContent = 'Name';
    nameLabel.title = 'Custom name for this set (leave blank to auto-generate)';
    const nameInput = createInput(set.name || '', 'Auto-generated from presets');
    nameInput.title = 'Leave blank to auto-generate from selected preset names';

    const autoName = document.createElement('div');
    autoName.className = 'label';
    const previewSpan = document.createElement('span');
    previewSpan.className = 'small';
    previewSpan.textContent = 'Preview: ' + (set.presetIds || []).map(getPresetNickname).join(' | ');
    autoName.append(previewSpan);

    nameRow.append(nameLabel, nameInput, autoName, document.createElement('div'));

    // Presets selection
    const presetsRow = document.createElement('div');
    presetsRow.className = 'preset-selector';

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'label';
    presetsLabel.textContent = 'Presets';
    presetsLabel.title = 'Select which presets to launch';

    const selectedList = document.createElement('div');
    selectedList.className = 'selected-presets';

    // Render selected presets (ordered)
    const selectedIds = set.presetIds || [];
    selectedIds.forEach((presetId, pIndex) => {
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;

      const item = document.createElement('div');
      item.className = 'selected-preset-item';

      const name = document.createElement('span');
      name.textContent = preset.nickname;

      const controls = document.createElement('div');
      controls.className = 'preset-controls';

      const moveUp = document.createElement('button');
      moveUp.textContent = '↑';
      moveUp.title = 'Move up';
      moveUp.disabled = pIndex === 0;
      moveUp.addEventListener('click', () => {
        if (pIndex === 0) return;
        selectedIds.splice(pIndex, 1);
        selectedIds.splice(pIndex - 1, 0, presetId);
        renderSets();
      });

      const moveDown = document.createElement('button');
      moveDown.textContent = '↓';
      moveDown.title = 'Move down';
      moveDown.disabled = pIndex === selectedIds.length - 1;
      moveDown.addEventListener('click', () => {
        if (pIndex === selectedIds.length - 1) return;
        selectedIds.splice(pIndex, 1);
        selectedIds.splice(pIndex + 1, 0, presetId);
        renderSets();
      });

      const removePreset = document.createElement('button');
      removePreset.textContent = '×';
      removePreset.title = 'Remove from set';
      removePreset.addEventListener('click', () => {
        const idx = selectedIds.indexOf(presetId);
        if (idx >= 0) selectedIds.splice(idx, 1);
        renderSets();
      });

      controls.append(moveUp, moveDown, removePreset);
      item.append(name, controls);
      selectedList.append(item);
    });

    // Add preset dropdown
    const addPresetWrap = document.createElement('div');
    addPresetWrap.className = 'add-preset-wrap';
    const addPresetSelect = document.createElement('select');
    addPresetSelect.title = 'Add a preset to this set';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '+ Add preset...';
    addPresetSelect.append(defaultOption);

    presets.filter(p => p.enabled !== false && !selectedIds.includes(p.id)).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nickname;
      addPresetSelect.append(opt);
    });

    addPresetSelect.addEventListener('change', () => {
      if (addPresetSelect.value) {
        selectedIds.push(addPresetSelect.value);
        renderSets();
      }
    });

    addPresetWrap.append(addPresetSelect);
    selectedList.append(addPresetWrap);

    presetsRow.append(presetsLabel, selectedList);

    // Status bar row
    const statusRow = document.createElement('div');
    statusRow.className = 'row';
    const statusLabel = document.createElement('div');
    statusLabel.className = 'label';
    statusLabel.textContent = 'Status bar';
    const statusWrap = document.createElement('div');
    statusWrap.className = 'inline';
    const statusInput = document.createElement('input');
    statusInput.type = 'checkbox';
    statusInput.checked = set.showInStatusBar !== false;
    statusInput.title = 'Show this command set in the status bar';
    const statusText = document.createElement('span');
    statusText.className = 'small';
    statusText.textContent = 'Show button';
    statusWrap.append(statusInput, statusText);

    statusRow.append(statusLabel, statusWrap, document.createElement('div'), document.createElement('div'));

    // Footer
    const footer = document.createElement('div');
    footer.className = 'footer';

    const enabledWrap = document.createElement('label');
    enabledWrap.className = 'small';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = set.enabled !== false;
    enabledInput.title = 'When disabled, this command set is hidden';
    enabledWrap.append(enabledInput, document.createTextNode(' Enabled'));

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete this command set';
    removeBtn.addEventListener('click', () => {
      commandSets.splice(index, 1);
      renderSets();
    });

    footer.append(enabledWrap, removeBtn);

    card.append(header, nameRow, presetsRow, statusRow, footer);
    card.__inputs = { nameInput, statusInput, enabledInput, presetIds: selectedIds };
    setList.append(card);
  });
}

function readCommandSetsFromDom() {
  return Array.from(setList.children).map((card, index) => {
    const { nameInput, statusInput, enabledInput, presetIds } = card.__inputs;
    const name = nameInput.value.trim();
    return {
      id: commandSets[index]?.id || `set-${Date.now()}-${index}`,
      name,
      presetIds: [...presetIds],
      showInStatusBar: statusInput.checked,
      enabled: enabledInput.checked
    };
  }).filter(s => s.presetIds.length > 0);
}

addBtn.addEventListener('click', () => {
  presets.push({ id: '', nickname: '', command: '', icon: '', enabled: true, showInStatusBar: true });
  render();
});

addSetBtn.addEventListener('click', () => {
  commandSets.push({ id: `set-${Date.now()}`, name: '', presetIds: [], showInStatusBar: true, enabled: true });
  renderSets();
});

saveBtn.addEventListener('click', () => {
  const updatedPresets = readPresetsFromDom();
  const updatedSets = readCommandSetsFromDom();
  vscode.postMessage({
    type: 'savePresets',
    presets: updatedPresets,
    commandSets: updatedSets,
    focusFirst: focusFirstCheckbox.checked
  });
});

focusFirstCheckbox.addEventListener('change', () => {
  focusFirst = focusFirstCheckbox.checked;
});

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'presets') {
    presets = msg.presets || [];
    commandSets = msg.commandSets || [];
    focusFirst = msg.focusFirst !== false;
    focusFirstCheckbox.checked = focusFirst;
    render();
    renderSets();
  }
  if (msg.type === 'pickedIcon') {
    const card = list.children[msg.rowId];
    if (!card) return;
    card.__inputs.iconInput.value = msg.path || '';
  }
});

vscode.postMessage({ type: 'requestPresets' });
