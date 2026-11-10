export type ActiveTab = 'default' | 'music';

const STORAGE_KEY = 'tag_editor_tab';

/** The tag editor tab the user was last on, so the next download opens there. */
export function loadActiveTab(): ActiveTab {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'music' ? 'music' : 'default';
  } catch {
    return 'default';
  }
}

export function saveActiveTab(tab: ActiveTab): void {
  try {
    localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Storage may be unavailable (e.g. privacy mode); the tab still works for this download.
  }
}
