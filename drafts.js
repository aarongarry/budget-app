const KEY = 'budget-entry-draft-v1';

export function normalizeDraft(value) {
  if (!value || !['expense', 'income'].includes(value.kind) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month || '')) return null;
  const draft = {
    kind: value.kind,
    month: value.month,
    id: typeof value.id === 'string' ? value.id.slice(0, 100) : '',
    amount: String(value.amount || '').slice(0, 32),
    category: String(value.category || '').slice(0, 100),
    description: String(value.description || '').slice(0, 120),
  };
  return draft.id || draft.amount || draft.category || draft.description ? draft : null;
}

export function readDraft(storage = localStorage) {
  try { return normalizeDraft(JSON.parse(storage.getItem(KEY) || 'null')); } catch { return null; }
}
export function writeDraft(value, storage = localStorage) {
  const draft = normalizeDraft(value);
  try {
    if (draft) storage.setItem(KEY, JSON.stringify(draft));
    else storage.removeItem(KEY);
  } catch { /* An unavailable draft store must not interrupt expense entry. */ }
}
export function clearDraft(storage = localStorage) {
  try { storage.removeItem(KEY); } catch { /* Keep expense saving independent of draft storage. */ }
}
