export type EntryRoute = 'idle' | 'opening' | 'settings';

export interface EntryIntent {
  readonly route: EntryRoute;
  readonly sequence: number;
}

type Listener = () => void;

let currentIntent: EntryIntent = {route: 'idle', sequence: 0};
const listeners = new Set<Listener>();

export const getEntryIntent = (): EntryIntent => currentIntent;

export const publishEntryIntent = (route: Exclude<EntryRoute, 'idle'>): void => {
  currentIntent = {route, sequence: currentIntent.sequence + 1};
  listeners.forEach(listener => listener());
};

export const subscribeEntryIntent = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
