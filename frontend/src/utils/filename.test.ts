import { describe, it, expect } from 'vitest';
import { safeFilename } from './filename';

describe('safeFilename', () => {
  it('preserves spaces', () => {
    expect(safeFilename('Artist - Title')).toBe('Artist - Title');
  });

  it('preserves letters, digits, punctuation except disallowed', () => {
    expect(safeFilename('Track (feat. Someone) 01')).toBe('Track (feat. Someone) 01');
  });

  it('strips only disallowed chars: \\ / : * ? " < > |', () => {
    expect(safeFilename('hello/world')).toBe('helloworld');
    expect(safeFilename('title<script>')).toBe('titlescript');
    expect(safeFilename('a*b?c:d')).toBe('abcd');
    expect(safeFilename('one|two"three')).toBe('onetwothree');
  });

  it('truncates at 100 chars', () => {
    expect(safeFilename('a'.repeat(200)).length).toBe(100);
  });

  it('returns "download" for empty or whitespace-only after trim', () => {
    expect(safeFilename('')).toBe('download');
    expect(safeFilename('   ')).toBe('download');
  });
});
