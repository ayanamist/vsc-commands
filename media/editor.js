const vscode = acquireVsCodeApi();

const list = document.getElementById('list');
const addBtn = document.getElementById('add');
const saveBtn = document.getElementById('save');

let presets = [];
let dragIndex = null;

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createInput(value) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
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
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => {
      if (index === 0) return;
      const item = presets.splice(index, 1)[0];
      presets.splice(index - 1, 0, item);
      render();
    });
    const downBtn = document.createElement('button');
    downBtn.textContent = 'Down';
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
    const idInput = createInput(preset.id);

    const nameLabel = document.createElement('div');
    nameLabel.className = 'label';
    nameLabel.textContent = 'Nickname';
    const nameInput = createInput(preset.nickname);

    row1.append(idLabel, idInput, nameLabel, nameInput);

    const row2 = document.createElement('div');
    row2.className = 'row';

    const cmdLabel = document.createElement('div');
    cmdLabel.className = 'label';
    cmdLabel.textContent = 'Command';
    const cmdInput = createInput(preset.command);

    const iconLabel = document.createElement('div');
    iconLabel.className = 'label';
    iconLabel.textContent = 'Icon';
    const iconWrap = document.createElement('div');
    iconWrap.className = 'inline';
    const iconInput = createInput(preset.icon);
    const pickBtn = document.createElement('button');
    pickBtn.textContent = 'Choose file';
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
    const statusWrap = document.createElement('div');
    statusWrap.className = 'inline';
    const statusInput = document.createElement('input');
    statusInput.type = 'checkbox';
    statusInput.checked = preset.showInStatusBar !== false;
    const statusText = document.createElement('span');
    statusText.className = 'small';
    statusText.textContent = 'Show button';
    statusWrap.append(statusInput, statusText);

    const colorLabel = document.createElement('div');
    colorLabel.className = 'label';
    colorLabel.textContent = 'Status color';
    const colorInput = createInput(preset.statusBarColor);

    row3.append(statusLabel, statusWrap, colorLabel, colorInput);

    const footer = document.createElement('div');
    footer.className = 'footer';

    const enabledWrap = document.createElement('label');
    enabledWrap.className = 'small';
    const enabledInput = document.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.checked = preset.enabled !== false;
    enabledWrap.append(enabledInput, document.createTextNode(' Enabled'));

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
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

addBtn.addEventListener('click', () => {
  presets.push({ id: '', nickname: '', command: '', icon: '', enabled: true });
  render();
});

saveBtn.addEventListener('click', () => {
  const updated = readPresetsFromDom();
  vscode.postMessage({ type: 'savePresets', presets: updated });
});

window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'presets') {
    presets = msg.presets || [];
    render();
  }
  if (msg.type === 'pickedIcon') {
    const card = list.children[msg.rowId];
    if (!card) return;
    card.__inputs.iconInput.value = msg.path || '';
  }
});

vscode.postMessage({ type: 'requestPresets' });
