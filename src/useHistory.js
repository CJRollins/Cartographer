import { useState, useCallback } from 'react';

const MAX_HISTORY = 40;

export function useHistory(getSnapshot, applySnapshot) {
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const pushHistory = useCallback(() => {
    setPast(p => [getSnapshot(), ...p].slice(0, MAX_HISTORY));
    setFuture([]);
  }, [getSnapshot]);

  const undo = useCallback(() => {
    if (!past.length) return false;
    setFuture(f => [getSnapshot(), ...f]);
    const prev = past[0];
    setPast(p => p.slice(1));
    applySnapshot(prev);
    return true;
  }, [past, getSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (!future.length) return false;
    setPast(p => [getSnapshot(), ...p]);
    const next = future[0];
    setFuture(f => f.slice(1));
    applySnapshot(next);
    return true;
  }, [future, getSnapshot, applySnapshot]);

  return { pushHistory, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
