import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats cents as cedi with two decimal places', () => {
    expect(formatMoney(50000)).toBe('₵500.00');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(0)).toBe('₵0.00');
  });

  it('adds thousands separators for large amounts', () => {
    expect(formatMoney(2520000)).toBe('₵25,200.00');
  });

  it('rounds sub-cent noise to two decimal places', () => {
    expect(formatMoney(1099)).toBe('₵10.99');
  });
});
