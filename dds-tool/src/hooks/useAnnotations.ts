'use client';

import { useState, useCallback } from 'react';
import type { AnnotationEntry, ReasonCode } from '../types';

// these two reasons belong to TM, so they need a TM comment before the line counts as annotated
const TM_REASONS: ReasonCode[] = ['transit_delay', 'booking_not_made'];

interface AnnotationState {
  entries: Record<string, AnnotationEntry>;
  addAnnotation: (key: string, data: Partial<AnnotationEntry>) => void;
  updateAnnotation: (key: string, data: Partial<AnnotationEntry>) => void;
  isAnnotated: (key: string) => boolean;
  tmComment: string;
  setTmComment: (v: string) => void;
  tmName: string;
  setTmName: (v: string) => void;
  reset: () => void;
}

export function useAnnotations(): AnnotationState {
  const [entries, setEntries] = useState<Record<string, AnnotationEntry>>({});
  const [tmComment, setTmComment] = useState('');
  const [tmName, setTmName] = useState('');

  const addAnnotation = useCallback((key: string, data: Partial<AnnotationEntry>) => {
    setEntries((prev) => ({
      ...prev,
      [key]: {
        poLine: key,
        reason: data.reason ?? 'other',
        tmComment: data.tmComment ?? '',
        scmComment: data.scmComment ?? '',
        annotatedAt: new Date(),
        ...data,
      },
    }));
  }, []);

  const updateAnnotation = useCallback((key: string, data: Partial<AnnotationEntry>) => {
    setEntries((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], ...data, annotatedAt: new Date() },
      };
    });
  }, []);

  // a line is only "done" if it has a reason AND any required comment fields are filled
  const isAnnotated = useCallback(
    (key: string): boolean => {
      const entry = entries[key];
      if (!entry || !entry.reason) return false;
      if (TM_REASONS.includes(entry.reason) && !tmComment.trim()) return false;
      if (entry.reason === 'other' && !entry.scmComment?.trim()) return false;
      return true;
    },
    [entries, tmComment]
  );

  // reset everything when new files are uploaded, old annotations don't apply to new data
  const reset = useCallback(() => {
    setEntries({});
    setTmComment('');
    setTmName('');
  }, []);

  return { entries, addAnnotation, updateAnnotation, isAnnotated, tmComment, setTmComment, tmName, setTmName, reset };
}
