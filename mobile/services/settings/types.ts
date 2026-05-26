// App/timer settings (M3.4).
//
// First setting: the background-during-session policy (resolves decisions.md O4).
// Kept as a small, extensible blob so future user settings slot in beside it.

export type BackgroundPolicy =
  | 'forgiving' // >30s backgrounded during a session = 1 distraction (O4 default)
  | 'strict'; // any background during a session = 1 distraction

export const BACKGROUND_POLICIES: readonly BackgroundPolicy[] = ['forgiving', 'strict'];

export interface Settings {
  backgroundPolicy: BackgroundPolicy;
}

export const DEFAULT_SETTINGS: Settings = {
  backgroundPolicy: 'forgiving',
};
