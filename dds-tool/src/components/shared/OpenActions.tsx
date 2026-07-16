'use client';

import { useState } from 'react';
import type { ActionItem } from '../../types';
import { Badge } from './Badge';
import { Button } from './Button';
import { formatDateMedium } from '../../lib/dateUtils';

export function OpenActions() {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');

  const openCount = actions.filter((a) => a.status !== 'done').length;

  const addAction = () => {
    if (!newTitle.trim()) return;
    setActions((prev) => [
      ...prev,
      {
        id: `action-${Date.now()}`,
        title: newTitle.trim(),
        createdAt: new Date(),
        status: 'open',
        assignedTo: newAssignee.trim() || 'Unassigned',
      },
    ]);
    setNewTitle('');
    setNewAssignee('');
  };

  const cycleStatus = (id: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === 'open' ? 'in_progress' : a.status === 'in_progress' ? 'done' : 'open' }
          : a
      )
    );
  };

  const statusVariant = (s: ActionItem['status']) =>
    s === 'done' ? 'pass' : s === 'in_progress' ? 'warn' : 'neutral';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 bg-navy text-white px-4 py-2.5 rounded-full text-sm font-medium shadow-lg hover:bg-opacity-90 transition-all z-40 flex items-center gap-2"
      >
        Open Actions
        {openCount > 0 && (
          <span className="bg-brand text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {openCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-dark/30" onClick={() => setOpen(false)} />
          <div className="relative bg-card rounded-lg border border-border w-full max-w-lg mx-4 flex flex-col max-h-[80vh]" style={{ boxShadow: 'var(--shadow-slide)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-navy text-base">Open Actions</h2>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-dark">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {actions.length === 0 && (
                <p className="text-muted text-sm text-center py-6">No actions yet</p>
              )}
              {actions.map((a) => (
                <div key={a.id} className="border border-border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium ${a.status === 'done' ? 'line-through text-muted' : 'text-dark'}`}>{a.title}</span>
                    <Badge variant={statusVariant(a.status)}>
                      {a.status === 'in_progress' ? 'In Progress' : a.status === 'done' ? 'Done' : 'Open'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>{a.assignedTo}</span>
                    <span>{formatDateMedium(a.createdAt)}</span>
                    {a.linkedPO && <span className="text-brand">{a.linkedPO}</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => cycleStatus(a.id)}>
                    {a.status === 'open' ? 'Start →' : a.status === 'in_progress' ? 'Mark done ✓' : 'Reopen'}
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-4 space-y-2">
              <input
                type="text"
                placeholder="Action title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addAction(); }}
                className="w-full text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Assigned to..."
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="flex-1 text-sm border border-border rounded px-3 py-1.5 focus:outline-none focus:border-brand"
                />
                <Button onClick={addAction} size="sm">Add</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
