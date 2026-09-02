import type { ActionItem } from '../types/actions';

const STORAGE_KEY = 'pct_actions';

export function loadActions(): ActionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveActions(actions: ActionItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch (err) {
    console.error('actionsStorage: failed to persist actions', err);
  }
}
