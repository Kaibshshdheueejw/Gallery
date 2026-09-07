import { useCallback, useState } from 'react';

export interface SelectionApi {
  selection: Set<string>;
  active: boolean;
  enter: (id?: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
  setAll: (ids: string[]) => void;
}

export function useSelection(): SelectionApi {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const active = selection.size > 0;

  const enter = useCallback((id?: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (id) next.add(id);
      return next;
    });
  }, []);
  const toggle = useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelection(new Set()), []);
  const setAll = useCallback((ids: string[]) => setSelection(new Set(ids)), []);

  return { selection, active, enter, toggle, clear, setAll };
}
