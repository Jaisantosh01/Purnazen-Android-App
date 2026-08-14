import {
  appointmentBreakdown,
  feeBreakdown,
  formatAmount,
  formatRupees,
  gstLabel,
} from '../../utils/tax';

describe('feeBreakdown', () => {
  it('applies the configured rate', () => {
    expect(feeBreakdown(1000, 18)).toEqual({
      base: 1000, gstPercentage: 18, gst: 180, total: 1180,
    });
  });

  it('treats a zero rate as no tax', () => {
    expect(feeBreakdown(800, 0)).toEqual({
      base: 800, gstPercentage: 0, gst: 0, total: 800,
    });
  });

  it('falls back to no tax when the rate is unknown', () => {
    expect(feeBreakdown(800, null).total).toBe(800);
    expect(feeBreakdown(800, undefined).total).toBe(800);
  });

  // Must match the backend, which quantizes to 2dp half-up in TaxService —
  // a mismatch here shows up as the checkout total differing by a paisa from
  // the quote the user just agreed to.
  it.each([
    [499.5, 18, 89.91, 589.41],
    [333, 18, 59.94, 392.94],
    [1, 18, 0.18, 1.18],
  ])('rounds %p at %p%% to 2dp', (base, pct, gst, total) => {
    const result = feeBreakdown(base, pct);
    expect(result.gst).toBe(gst);
    expect(result.total).toBe(total);
  });

  it('handles a missing fee', () => {
    expect(feeBreakdown(undefined, 18)).toEqual({
      base: 0, gstPercentage: 18, gst: 0, total: 0,
    });
  });
});

describe('appointmentBreakdown', () => {
  it('prefers the figures settled on the appointment', () => {
    const appointment = { fee: 1000, gstPercentage: 12, gstAmount: 120, totalAmount: 1120 };
    expect(appointmentBreakdown(appointment, 28)).toEqual({
      base: 1000, gstPercentage: 12, gst: 120, total: 1120,
    });
  });

  it('derives the amounts when only the snapshotted rate is present', () => {
    expect(appointmentBreakdown({ fee: 1000, gstPercentage: 18 })).toEqual({
      base: 1000, gstPercentage: 18, gst: 180, total: 1180,
    });
  });

  it('treats a pre-GST appointment as tax-free by default', () => {
    expect(appointmentBreakdown({ fee: 900 })).toEqual({
      base: 900, gstPercentage: 0, gst: 0, total: 900,
    });
  });

  it('applies the live rate to a snapshotless appointment when one is given', () => {
    expect(appointmentBreakdown({ fee: 900 }, 10).total).toBe(990);
  });

  it('survives a missing appointment', () => {
    expect(appointmentBreakdown(null).total).toBe(0);
  });
});

describe('formatting', () => {
  it('drops trailing zeros on whole rupees', () => {
    expect(formatAmount(590)).toBe('590');
    expect(formatRupees(590)).toBe('₹590');
  });

  it('keeps paise when there are any', () => {
    expect(formatAmount(589.41)).toBe('589.41');
    expect(formatRupees(589.41)).toBe('₹589.41');
  });

  it('labels the GST row with its rate, without padding it to paise', () => {
    expect(gstLabel(18)).toBe('GST (18%)');
    expect(gstLabel(12.5)).toBe('GST (12.5%)');
    expect(gstLabel(0)).toBe('GST (0%)');
  });
});
