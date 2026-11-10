import { describe, it, expect } from 'vitest';
import { loadActiveTab, saveActiveTab } from './activeTab';

describe('activeTab persistence', () => {
  it('defaults to the default tab when nothing is stored', () => {
    expect(loadActiveTab()).toBe('default');
  });

  it('remembers the music tab', () => {
    saveActiveTab('music');
    expect(loadActiveTab()).toBe('music');
  });

  it('ignores unexpected stored values', () => {
    localStorage.setItem('tag_editor_tab', 'bogus');
    expect(loadActiveTab()).toBe('default');
  });
});
