import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { savedRepository } from './repository';
import {
  EMPTY_SAVED,
  isTripSaved,
  removePlace,
  removeTrip,
  setPlace,
  toggleTrip,
  type SavedState,
  type SavedStation,
} from './model';

interface SavedApi extends SavedState {
  loaded: boolean;
  isTripSaved: (fromCode: string, toCode: string) => boolean;
  /** Returns true when the trip is now saved, false when it was removed. */
  toggleTrip: (from: SavedStation, to: SavedStation) => boolean;
  removeTrip: (fromCode: string, toCode: string) => void;
  setPlace: (label: string, station: SavedStation) => void;
  removePlace: (label: string) => void;
}

const SavedContext = createContext<SavedApi | null>(null);

/**
 * Holds saved trips and places for the whole app. Changes apply at once and
 * are written in the background, the same way settings are.
 */
export function SavedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavedState>(EMPTY_SAVED);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(EMPTY_SAVED);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void savedRepository.load().then((stored) => {
      if (!active) return;
      current.current = stored;
      setState(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((change: (current: SavedState) => SavedState) => {
    const next = change(current.current);
    if (next === current.current) return;
    current.current = next;
    setState(next);
    writes.current = writes.current.then(() => savedRepository.save(next)).catch(() => undefined);
  }, []);

  const value = useMemo<SavedApi>(
    () => ({
      ...state,
      loaded,
      isTripSaved: (fromCode, toCode) => isTripSaved(state, fromCode, toCode),
      toggleTrip: (from, to) => {
        update((current) => toggleTrip(current, from, to, Date.now()));
        return isTripSaved(current.current, from.code, to.code);
      },
      removeTrip: (fromCode, toCode) => update((current) => removeTrip(current, fromCode, toCode)),
      setPlace: (label, station) => update((current) => setPlace(current, label, station)),
      removePlace: (label) => update((current) => removePlace(current, label)),
    }),
    [state, loaded, update],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedApi {
  const value = useContext(SavedContext);
  if (!value) throw new Error('useSaved needs a SavedProvider');
  return value;
}
