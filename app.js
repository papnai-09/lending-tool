const STORAGE_KEY = 'tool-lending-library-records-v1';
const roles = {
  manager: { create: true, read: true, update: true, delete: true },
  staff: { create: true, read: true, update: true, delete: false },
};

function createId() {
  return globalThis.crypto?.randomUUID?.() || `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const seedRecords = [
  {
    id: createId(),
    name: 'Cordless Drill',
    category: 'Power Tools',
    assetCode: 'TL-1001',
    status: 'Available',
    borrower: '',
    notes: 'Battery checked and charged.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: createId(),
    name: 'Safety Goggles Set',
    category: 'Safety',
    assetCode: 'TL-2044',
    status: 'Checked Out',
    borrower: 'Maya Patel',
    notes: 'Due back after workshop.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: createId(),
    name: 'Tile Cutter',
    category: 'Workshop',
    assetCode: 'TL-3180',
    status: 'Maintenance',
    borrower: '',
    notes: 'Blade guard inspection pending.',
    updatedAt: new Date().toISOString(),
  },
];

const state = {
  records: [],
  editingId: null,
  role: 'manager',
  search: '',
  loading: false,
  toastTimer: null,
};

const elements = {
  form: document.querySelector('#tool-form'),
  formTitle: document.querySelector('#form-title'),
  submitButton: document.querySelector('#submit-button'),
  submitButtonLabel: document.querySelector('#submit-button span'),
  resetButton: document.querySelector('#reset-button'),
  roleSelect: document.querySelector('#role-select'),
  authMessage: document.querySelector('#auth-message'),
  searchInput: document.querySelector('#search-input'),
  loading: document.querySelector('#loading'),
  emptyState: document.querySelector('#empty-state'),
  recordsBody: document.querySelector('#records-body'),
  recordCount: document.querySelector('#record-count'),
  recordsPanel: document.querySelector('#records-panel'),
  statTotal: document.querySelector('#stat-total'),
  statAvailable: document.querySelector('#stat-available'),
  statCheckedOut: document.querySelector('#stat-checked-out'),
  statMaintenance: document.querySelector('#stat-maintenance'),
  toast: document.querySelector('#toast'),
};

function sanitizeText(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value ?? '');
  return template.content.textContent.trim();
}

function logAnalytics(action) {
  console.log(`[Analytics] User interacted with Feature Complete CRUD: ${action}`);
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function can(action) {
  return Boolean(roles[state.role]?.[action]);
}

function formatRole(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function readStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    showToast('Changes saved for this session only.');
  }
}

function setLoading(isLoading) {
  state.loading = isLoading;
  elements.loading.hidden = !isLoading;
  elements.recordsPanel.setAttribute('aria-busy', String(isLoading));
  elements.submitButton.disabled = isLoading || !can(state.editingId ? 'update' : 'create');
  elements.resetButton.disabled = isLoading;
  document.querySelectorAll('.action-button').forEach((button) => {
    button.disabled = isLoading || button.dataset.disallowed === 'true';
  });
}

function simulateAsync(callback) {
  setLoading(true);
  window.setTimeout(() => {
    callback();
    setLoading(false);
    render();
  }, 380);
}

function loadRecords() {
  const stored = readStorage();
  if (!stored) {
    state.records = seedRecords;
    saveRecords();
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    state.records = Array.isArray(parsed) ? parsed.map(normalizeStoredRecord) : [];
  } catch {
    state.records = [];
  }
}

function normalizeStoredRecord(record) {
  return {
    id: sanitizeText(record.id) || createId(),
    name: sanitizeText(record.name),
    category: sanitizeText(record.category),
    assetCode: normalizeAssetCode(record.assetCode),
    status: sanitizeText(record.status) || 'Available',
    borrower: sanitizeText(record.borrower),
    notes: sanitizeText(record.notes),
    updatedAt: sanitizeText(record.updatedAt) || new Date().toISOString(),
  };
}

function saveRecords() {
  writeStorage(state.records);
}

function normalizeAssetCode(value) {
  return sanitizeText(value).toUpperCase();
}

function validateRecord(formData) {
  const record = {
    name: sanitizeText(formData.get('name')),
    category: sanitizeText(formData.get('category')),
    assetCode: normalizeAssetCode(formData.get('assetCode')),
    status: sanitizeText(formData.get('status')),
    borrower: sanitizeText(formData.get('borrower')),
    notes: sanitizeText(formData.get('notes')),
  };

  const errors = {};
  if (record.name.length < 2) {
    errors.name = 'Enter a tool name with at least 2 characters.';
  }
  if (!record.category) {
    errors.category = 'Select a category.';
  }
  if (!/^TL-\d{4,}$/.test(record.assetCode)) {
    errors.assetCode = 'Use the format TL-1001.';
  }
  if (!record.status) {
    errors.status = 'Select a status.';
  }
  if (record.status === 'Checked Out' && record.borrower.length < 2) {
    errors.borrower = 'Enter the borrower name for checked out tools.';
  }

  const duplicate = state.records.find((item) => {
    return item.assetCode === record.assetCode && item.id !== state.editingId;
  });
  if (duplicate) {
    errors.assetCode = 'Asset code must be unique.';
  }

  return { record, errors };
}

function showErrors(errors) {
  const fields = ['name', 'category', 'assetCode', 'status', 'borrower'];
  fields.forEach((field) => {
    const control = elements.form.elements[field];
    const wrapper = control.closest('.field');
    const error = document.querySelector(`#${control.getAttribute('aria-describedby')}`);
    const message = errors[field] || '';
    wrapper.classList.toggle('invalid', Boolean(message));
    control.setAttribute('aria-invalid', String(Boolean(message)));
    error.textContent = message;
  });

  const firstError = fields.find((field) => errors[field]);
  if (firstError) {
    elements.form.elements[firstError].focus();
  }
}

function clearErrors() {
  showErrors({});
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  clearErrors();
  renderFormMode();
}

function renderFormMode() {
  const action = state.editingId ? 'update' : 'create';
  const allowed = can(action);
  elements.formTitle.textContent = state.editingId ? 'Edit Tool' : 'Add Tool';
  elements.submitButtonLabel.textContent = state.editingId ? 'Update Tool' : 'Create Tool';
  elements.submitButton.disabled = state.loading || !allowed;
  elements.authMessage.textContent = allowed ? '' : `${formatRole(state.role)} role cannot ${action} records.`;
}

function getFilteredRecords() {
  const query = state.search.toLowerCase();
  if (!query) {
    return state.records;
  }

  return state.records.filter((record) => {
    return [record.name, record.category, record.assetCode, record.status, record.borrower, record.notes]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function renderStats() {
  elements.statTotal.textContent = state.records.length;
  elements.statAvailable.textContent = countByStatus('Available');
  elements.statCheckedOut.textContent = countByStatus('Checked Out');
  elements.statMaintenance.textContent = countByStatus('Maintenance');
}

function countByStatus(status) {
  return state.records.filter((record) => record.status === status).length;
}

function renderRecords() {
  const records = getFilteredRecords();
  elements.recordsBody.textContent = '';
  elements.recordCount.textContent = `${records.length} ${records.length === 1 ? 'record' : 'records'}`;
  elements.emptyState.hidden = state.loading || records.length > 0;

  records.forEach((record) => {
    const row = document.createElement('tr');
    row.append(
      toolCell(record),
      tableCell(record.category, false, 'Category'),
      statusCell(record.status),
      tableCell(record.borrower || 'Unassigned', !record.borrower, 'Borrower'),
      tableCell(formatDate(record.updatedAt), true, 'Updated'),
      actionCell(record),
    );
    elements.recordsBody.append(row);
  });
}

function toolCell(record) {
  const cell = document.createElement('td');
  cell.dataset.label = 'Tool';
  const wrapper = document.createElement('div');
  const name = document.createElement('span');
  const meta = document.createElement('span');
  wrapper.className = 'tool-cell';
  name.className = 'tool-name';
  meta.className = 'tool-meta asset-code';
  name.textContent = record.name;
  meta.textContent = record.assetCode;
  wrapper.append(name, meta);

  if (record.notes) {
    const notes = document.createElement('span');
    notes.className = 'tool-meta';
    notes.textContent = record.notes;
    wrapper.append(notes);
  }

  cell.append(wrapper);
  return cell;
}

function tableCell(text, muted = false, label = '') {
  const cell = document.createElement('td');
  if (label) {
    cell.dataset.label = label;
  }
  cell.textContent = text;
  if (muted) {
    cell.className = 'cell-muted';
  }
  return cell;
}

function statusCell(status) {
  const cell = document.createElement('td');
  cell.dataset.label = 'Status';
  const badge = document.createElement('span');
  badge.className = `status is-${status.toLowerCase().replace(/\s+/g, '-')}`;
  badge.textContent = status;
  cell.append(badge);
  return cell;
}

function actionCell(record) {
  const cell = document.createElement('td');
  cell.dataset.label = 'Actions';
  const actions = document.createElement('div');
  actions.className = 'actions';

  const editButton = actionButton({
    label: `Edit ${record.name}`,
    title: 'Edit record',
    path: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z',
    disallowed: !can('update'),
    onClick: () => startEdit(record.id),
  });

  const deleteButton = actionButton({
    label: `Delete ${record.name}`,
    title: 'Delete record',
    path: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
    danger: true,
    disallowed: !can('delete'),
    onClick: () => deleteRecord(record.id),
  });

  actions.append(editButton, deleteButton);
  cell.append(actions);
  return cell;
}

function actionButton({ label, title, path, danger = false, disallowed, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'action-button danger' : 'action-button';
  button.dataset.disallowed = String(disallowed);
  button.setAttribute('aria-label', label);
  button.title = title;
  button.disabled = disallowed || state.loading;
  button.append(createIcon(path));
  button.addEventListener('click', onClick);
  return button;
}

function createIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function render() {
  renderFormMode();
  renderStats();
  renderRecords();
}

function createRecord(record) {
  state.records.unshift({
    id: createId(),
    ...record,
    updatedAt: new Date().toISOString(),
  });
  saveRecords();
  resetForm();
  showToast('Tool record created.');
  logAnalytics('created record');
}

function updateRecord(record) {
  state.records = state.records.map((item) => {
    if (item.id !== state.editingId) {
      return item;
    }
    return { ...item, ...record, updatedAt: new Date().toISOString() };
  });
  saveRecords();
  resetForm();
  showToast('Tool record updated.');
  logAnalytics('updated record');
}

function startEdit(id) {
  if (!can('update')) {
    renderFormMode();
    return;
  }

  const record = state.records.find((item) => item.id === id);
  if (!record) {
    return;
  }

  state.editingId = id;
  elements.form.elements.name.value = record.name;
  elements.form.elements.category.value = record.category;
  elements.form.elements.assetCode.value = record.assetCode;
  elements.form.elements.status.value = record.status;
  elements.form.elements.borrower.value = record.borrower;
  elements.form.elements.notes.value = record.notes;
  clearErrors();
  renderFormMode();
  elements.form.elements.name.focus();
  logAnalytics('started editing record');
}

function deleteRecord(id) {
  if (!can('delete')) {
    renderFormMode();
    return;
  }

  const record = state.records.find((item) => item.id === id);
  if (!record) {
    return;
  }

  const confirmed = window.confirm(`Delete ${record.name}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  simulateAsync(() => {
    state.records = state.records.filter((item) => item.id !== id);
    if (state.editingId === id) {
      resetForm();
    }
    saveRecords();
    showToast('Tool record deleted.');
    logAnalytics('deleted record');
  });
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const action = state.editingId ? 'update' : 'create';
  if (!can(action)) {
    renderFormMode();
    return;
  }

  const { record, errors } = validateRecord(new FormData(elements.form));
  showErrors(errors);
  if (Object.keys(errors).length > 0) {
    return;
  }

  simulateAsync(() => {
    if (state.editingId) {
      updateRecord(record);
    } else {
      createRecord(record);
    }
  });
});

elements.resetButton.addEventListener('click', resetForm);

elements.roleSelect.addEventListener('change', (event) => {
  state.role = event.target.value;
  if (state.editingId && !can('update')) {
    resetForm();
  }
  render();
});

elements.searchInput.addEventListener('input', (event) => {
  state.search = sanitizeText(event.target.value);
  renderRecords();
});

loadRecords();
render();
