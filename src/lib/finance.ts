// Financial calculation utilities for the DealFlow calculators.
// All formulas use standard fixed-rate amortization. Pure functions,
// fully testable, no I/O.

/** Monthly payment for a fixed-rate amortizing loan.
 *  principal > 0, annualRatePercent >= 0, termMonths > 0.
 *  Zero-interest loans are handled safely (no division by zero). */
export function monthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Remaining balance of a fixed-rate loan after `monthsPaid` payments. */
export function remainingBalance(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
  monthsPaid: number,
): number {
  if (principal <= 0) return 0;
  if (monthsPaid <= 0) return principal;
  if (monthsPaid >= termMonths) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return Math.max(0, principal - (principal / termMonths) * monthsPaid);
  const pmt = monthlyPayment(principal, annualRatePercent, termMonths);
  const factor = Math.pow(1 + r, monthsPaid);
  const bal = principal * factor - pmt * ((factor - 1) / r);
  return Math.max(0, bal);
}

/** Total interest paid over the life of a fixed-rate loan. */
export function totalInterest(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  return monthlyPayment(principal, annualRatePercent, termMonths) * termMonths - principal;
}

/** Coerce a possibly-empty/blank value to a number or null. */
export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Sum of nullable numbers (null treated as 0). */
export function sum(...values: (number | null | undefined)[]): number {
  return values.reduce((acc, v) => acc + (v ?? 0), 0);
}

/** Median of a list of numbers (empty -> null). */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Average of a list of numbers (empty -> null). */
export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
