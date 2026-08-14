import { useEffect, useState } from 'react';
import consultService from '../services/consultService';

/**
 * The admin-configured GST rate, for screens that quote a fee before an
 * appointment row exists (doctor profile, booking summary). Once an appointment
 * has been created it carries its own snapshot — use `appointmentBreakdown`
 * with that instead, so a later rate change can't restate an existing booking.
 *
 * The value is cached for the lifetime of the app process: it is one number an
 * admin edits perhaps once a year, and refetching it on every screen would make
 * the fee visibly jump as each request lands.
 *
 * Returns { gstPercentage, loading }. On failure `gstPercentage` stays null and
 * callers fall back to showing the bare fee — never a guessed rate.
 */

let cached = null;
let inFlight = null;

const fetchConfig = () => {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    // Wrapped so a synchronous throw becomes a rejection: the rate is a display
    // detail, and no screen should fail to render because it couldn't be read.
    inFlight = Promise.resolve()
      .then(() => consultService.getTaxConfig())
      .then(data => {
        cached = { gstPercentage: Number(data?.gstPercentage) || 0 };
        return cached;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
};

/** Test/logout hook — drops the memoized rate so the next read refetches. */
export const resetTaxConfigCache = () => { cached = null; inFlight = null; };

const useTaxConfig = () => {
  const [gstPercentage, setGstPercentage] = useState(cached?.gstPercentage ?? null);
  const [loading, setLoading] = useState(cached == null);

  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    fetchConfig()
      .then(config => { if (active) setGstPercentage(config.gstPercentage); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { gstPercentage, loading };
};

export default useTaxConfig;
