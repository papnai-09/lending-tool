import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STORAGE_KEY = 'tool-lending-library-records-v2';

const PERMISSIONS = {
  manager: { create: true, read: true, update: true, delete: true },
  staff: { create: true, read: true, update: true, delete: false },
};

const EMPTY_FORM = {
  name: '',
  category: '',
  assetCode: '',
  status: '',
  borrower: '',
  notes: '',
};

const SEED_RECORDS = [
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

function createId() {
  return globalThis.crypto?.randomUUID?.() || `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeText(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value ?? '');
  return template.content.textContent.trim();
}

function normalizeAssetCode(value) {
  return sanitizeText(value).toUpperCase();
}

function normalizeRecord(record) {
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

function loadRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_RECORDS));
      return SEED_RECORDS;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch {
    return SEED_RECORDS;
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function validateRecord(record, records, editingId) {
  const clean = {
    name: sanitizeText(record.name),
    category: sanitizeText(record.category),
    assetCode: normalizeAssetCode(record.assetCode),
    status: sanitizeText(record.status),
    borrower: sanitizeText(record.borrower),
    notes: sanitizeText(record.notes),
  };

  const errors = {};
  if (clean.name.length < 2) errors.name = 'Enter at least 2 characters.';
  if (!clean.category) errors.category = 'Choose a category.';
  if (!/^TL-\d{4,}$/.test(clean.assetCode)) errors.assetCode = 'Use format TL-1001.';
  if (!clean.status) errors.status = 'Choose a status.';
  if (clean.status === 'Checked Out' && clean.borrower.length < 2) {
    errors.borrower = 'Borrower is required when checked out.';
  }
  if (records.some((item) => item.assetCode === clean.assetCode && item.id !== editingId)) {
    errors.assetCode = 'Asset code must be unique.';
  }

  return { clean, errors };
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [role, setRole] = useState('manager');
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState('');

  const can = PERMISSIONS[role];
  const mode = editingId ? 'update' : 'create';
  const canSubmit = can[mode];

  const filteredRecords = useMemo(() => {
    const normalizedQuery = sanitizeText(query).toLowerCase();
    if (!normalizedQuery) return records;
    return records.filter((record) =>
      [record.name, record.category, record.assetCode, record.status, record.borrower, record.notes]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, records]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      available: records.filter((record) => record.status === 'Available').length,
      checkedOut: records.filter((record) => record.status === 'Checked Out').length,
      maintenance: records.filter((record) => record.status === 'Maintenance').length,
    };
  }, [records]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function persist(nextRecords, message, analyticsAction) {
    const saved = saveRecords(nextRecords);
    setRecords(nextRecords);
    setToast(saved ? message : 'Saved for this browser session only.');
    console.log(`[Analytics] User interacted with Feature Complete CRUD: ${analyticsAction}`);
  }

  function simulateAsync(callback) {
    setIsLoading(true);
    window.setTimeout(() => {
      callback();
      setIsLoading(false);
    }, 350);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const { clean, errors: nextErrors } = validateRecord(form, records, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    simulateAsync(() => {
      if (editingId) {
        const nextRecords = records.map((record) =>
          record.id === editingId ? { ...record, ...clean, updatedAt: new Date().toISOString() } : record,
        );
        persist(nextRecords, 'Tool record updated.', 'updated record');
      } else {
        const nextRecords = [{ id: createId(), ...clean, updatedAt: new Date().toISOString() }, ...records];
        persist(nextRecords, 'Tool record created.', 'created record');
      }
      resetForm();
    });
  }

  function startEdit(record) {
    if (!can.update) return;
    setEditingId(record.id);
    setForm({
      name: record.name,
      category: record.category,
      assetCode: record.assetCode,
      status: record.status,
      borrower: record.borrower,
      notes: record.notes,
    });
    setErrors({});
    console.log('[Analytics] User interacted with Feature Complete CRUD: started editing record');
    document.querySelector('#tool-name')?.focus();
  }

  function deleteRecord(record) {
    if (!can.delete) return;
    const confirmed = window.confirm(`Delete ${record.name}? This cannot be undone.`);
    if (!confirmed) return;

    simulateAsync(() => {
      const nextRecords = records.filter((item) => item.id !== record.id);
      persist(nextRecords, 'Tool record deleted.', 'deleted record');
      if (editingId === record.id) resetForm();
    });
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: '' }));
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#tool-form">Skip to tool form</a>

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">TL</div>
            <div>
              <p className="eyebrow">Core Operations</p>
              <h1>Tool Lending Library</h1>
            </div>
          </div>

          <div className="session-controls" aria-label="Session controls">
            <label htmlFor="role-select">Access role</label>
            <select
              id="role-select"
              aria-label="Select authorization role"
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                if (editingId && !PERMISSIONS[event.target.value].update) resetForm();
              }}
            >
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Inventory Console</p>
            <h2 id="page-title">Lending operations</h2>
          </div>
          <p className="record-pill" aria-live="polite">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
          </p>
        </section>

        <section className="stats-grid" aria-label="Inventory summary">
          <StatCard label="Total tools" value={stats.total} />
          <StatCard label="Available" value={stats.available} />
          <StatCard label="Checked out" value={stats.checkedOut} />
          <StatCard label="Maintenance" value={stats.maintenance} />
        </section>

        <div className="workspace-grid">
          <section className="records-panel" aria-labelledby="list-title" aria-busy={isLoading}>
            <div className="section-header">
              <div>
                <p className="eyebrow">Records</p>
                <h2 id="list-title">Tool register</h2>
              </div>
              <div className="search-wrap">
                <label htmlFor="search-input">Search records</label>
                <input
                  id="search-input"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, code, category"
                  aria-label="Search tool records"
                />
              </div>
            </div>

            {isLoading && (
              <div className="loading" role="status" aria-live="assertive">
                <span className="spinner" aria-hidden="true" />
                Syncing changes
              </div>
            )}

            {filteredRecords.length === 0 ? (
              <div className="empty-state" role="status">
                <h3>No data found</h3>
                <p>Create a tool record or refine the current search.</p>
              </div>
            ) : (
              <div className="records-list" aria-live="polite">
                {filteredRecords.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    canUpdate={can.update}
                    canDelete={can.delete}
                    isLoading={isLoading}
                    onEdit={startEdit}
                    onDelete={deleteRecord}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="form-panel" aria-labelledby="form-title">
            <div className="section-header compact">
              <div>
                <p className="eyebrow">Entry</p>
                <h2 id="form-title">{editingId ? 'Edit Tool' : 'Add Tool'}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={resetForm}
                aria-label="Clear form and cancel editing"
                disabled={isLoading}
              >
                Clear
              </button>
            </div>

            {!canSubmit && (
              <div className="notice" role="status" aria-live="polite">
                {role === 'staff' ? 'Staff cannot delete records, but can create and update.' : 'This role cannot submit records.'}
              </div>
            )}

            <form id="tool-form" noValidate onSubmit={handleSubmit}>
              <Field
                id="tool-name"
                label="Tool name"
                value={form.name}
                error={errors.name}
                onChange={(value) => updateField('name', value)}
              />

              <div className="field-row">
                <SelectField
                  id="tool-category"
                  label="Category"
                  value={form.category}
                  error={errors.category}
                  options={['Power Tools', 'Hand Tools', 'Garden', 'Safety', 'Workshop']}
                  onChange={(value) => updateField('category', value)}
                />
                <SelectField
                  id="tool-status"
                  label="Status"
                  value={form.status}
                  error={errors.status}
                  options={['Available', 'Checked Out', 'Maintenance']}
                  onChange={(value) => updateField('status', value)}
                />
              </div>

              <Field
                id="tool-code"
                label="Asset code"
                value={form.assetCode}
                error={errors.assetCode}
                placeholder="TL-1001"
                onChange={(value) => updateField('assetCode', value)}
              />

              <Field
                id="tool-borrower"
                label="Borrower"
                value={form.borrower}
                error={errors.borrower}
                placeholder="Required when checked out"
                onChange={(value) => updateField('borrower', value)}
              />

              <div className="field">
                <label htmlFor="tool-notes">Notes</label>
                <textarea
                  id="tool-notes"
                  value={form.notes}
                  rows="4"
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </div>

              <button className="primary-button" type="submit" disabled={isLoading || !canSubmit} aria-label="Save tool record">
                {editingId ? 'Update Tool' : 'Create Tool'}
              </button>
            </form>
          </aside>
        </div>
      </main>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RecordCard({ record, canUpdate, canDelete, isLoading, onEdit, onDelete }) {
  return (
    <article className="record-card">
      <div className="record-main">
        <div>
          <h3>{record.name}</h3>
          <p className="asset-code">{record.assetCode}</p>
          {record.notes && <p className="record-notes">{record.notes}</p>}
        </div>
        <span className="status-chip">{record.status}</span>
      </div>

      <dl className="record-details">
        <div>
          <dt>Category</dt>
          <dd>{record.category}</dd>
        </div>
        <div>
          <dt>Borrower</dt>
          <dd>{record.borrower || 'Unassigned'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(record.updatedAt)}</dd>
        </div>
      </dl>

      <div className="record-actions">
        <button type="button" onClick={() => onEdit(record)} disabled={isLoading || !canUpdate} aria-label={`Edit ${record.name}`}>
          Edit
        </button>
        <button type="button" onClick={() => onDelete(record)} disabled={isLoading || !canDelete} aria-label={`Delete ${record.name}`}>
          Delete
        </button>
      </div>
    </article>
  );
}

function Field({ id, label, value, error, placeholder = '', onChange }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-error`} className="error-message">{error || ''}</p>
    </div>
  );
}

function SelectField({ id, label, value, error, options, onChange }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <p id={`${id}-error`} className="error-message">{error || ''}</p>
    </div>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

createRoot(document.getElementById('root')).render(<App />);
