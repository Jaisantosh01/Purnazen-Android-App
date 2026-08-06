// Shared input validators so every form checks the same way.

// Proper address form: local@domain.tld with a real 2+ char TLD, no leading/
// trailing dots or consecutive dots in either part. Rejects "a@b", "x@y.c" and
// other malformed inputs that a loose \S+@\S+\.\S+ pattern lets through.
export const EMAIL_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const isValidEmail = email => EMAIL_RE.test(String(email || '').trim());

// The temp-mail services people actually reach for — a subset of the backend
// blocklist so obvious throwaways are caught instantly, offline. The backend
// (/auth/validate-email and /auth/register) stays authoritative: it also
// rejects non-existent domains via an MX lookup and a fuller list.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'yopmail.com',
  'throwawaymail.com', 'getnada.com', 'trashmail.com', 'maildrop.cc', 'moakt.com',
  'dispostable.com', 'fakeinbox.com', 'mohmal.com', '1secmail.com', 'discard.email',
  'dropmail.me', 'mailcatch.com', 'emailondeck.com', 'spam4.me', 'grr.la',
]);

// Returns a soft, user-facing message when the address is unusable, else null.
// Use for instant inline feedback on signup forms.
export const quickEmailIssue = email => {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return 'Please enter your email.';
  if (!EMAIL_RE.test(value)) return 'Please enter a valid email address.';
  const domain = value.split('@')[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return 'Please use a permanent email (like Gmail, Yahoo or Outlook), not a temporary one.';
  }
  return null;
};

// Phone: format check only. Real ownership verification needs an OTP/SMS round
// trip (Firebase Phone Auth = paid SMS), so we validate the shape and leave
// verification out. Mirrors the backend UpdateProfileRequest.phone pattern.
export const PHONE_RE = /^[+0-9 ()-]{6,10}$/;

export const isValidPhone = phone => PHONE_RE.test(String(phone || '').trim());
