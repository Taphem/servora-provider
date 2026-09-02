import { describe, expect, it } from 'vitest';
import { slugify } from '../../src/utils/slugify.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Jane The Plumber')).toBe('jane-the-plumber');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('AC/Heating -- Repair!!')).toBe('ac-heating-repair');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Jane--  ')).toBe('jane');
  });
});
