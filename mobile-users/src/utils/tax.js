/**
 * Fee / GST arithmetic, shared by every screen that quotes a consultation
 * (doctor profile, booking summary, checkout, confirmation, appointment
 * detail). One implementation means the "+ Tax" line, the GST line and the
 * total can never round differently from each other — or from the backend,
 * which quantizes the same way (2dp, half up) in `TaxService`.
 *
 * The rate itself is never hardcoded here: callers pass either the appointment's
 * snapshotted `gstPercentage` or the live admin value from `useTaxConfig`.
 */

const round2 = value => {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

/**
 * @param {number} baseFee        pre-tax consultation fee
 * @param {number} gstPercentage  configured rate; 0/undefined means no GST
 * @returns {{ base: number, gstPercentage: number, gst: number, total: number }}
 */
export const feeBreakdown = (baseFee, gstPercentage) => {
  const base = round2(baseFee);
  const percentage = Number(gstPercentage) || 0;
  const gst = round2((base * percentage) / 100);
  return { base, gstPercentage: percentage, gst, total: round2(base + gst) };
};

/**
 * Breakdown for an appointment returned by the API. Prefers the figures the
 * backend already settled at booking time, so a rate change in the admin panel
 * never restates an existing booking. `fallbackPercentage` only applies to rows
 * booked before GST was configurable, which carry no snapshot.
 */
export const appointmentBreakdown = (appointment, fallbackPercentage = 0) => {
  const base = Number(appointment?.fee) || 0;
  if (appointment?.gstPercentage == null) {
    return feeBreakdown(base, fallbackPercentage);
  }
  const percentage = Number(appointment.gstPercentage) || 0;
  const gst = appointment.gstAmount != null
    ? round2(appointment.gstAmount)
    : round2((base * percentage) / 100);
  const total = appointment.totalAmount != null
    ? round2(appointment.totalAmount)
    : round2(base + gst);
  return { base: round2(base), gstPercentage: percentage, gst, total };
};

/** Rupee amount without trailing ".00" on whole numbers. */
export const formatAmount = value => {
  const n = round2(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

/** "₹500" / "₹499.50" */
export const formatRupees = value => `₹${formatAmount(value)}`;

/**
 * Label for the GST row, e.g. "GST (18%)" / "GST (12.5%)".
 *
 * A rate is not money: it keeps only the decimals it has, where an amount pads
 * to paise. Running 12.5 through the money formatter would read "12.50%".
 */
export const gstLabel = gstPercentage => `GST (${round2(gstPercentage)}%)`;
