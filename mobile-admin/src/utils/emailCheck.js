// Instant, offline email sanity check for the signup/login forms.
//
// The backend (/auth/validate-email and /auth/register) is authoritative — it
// also rejects non-existent domains via an MX lookup and a fuller disposable
// list — but this gives the user soft feedback without waiting on the network.

// Proper address form: local@domain.tld with a real 2+ char TLD, no leading/
// trailing/consecutive dots. Rejects "a@b", "x@y.c" and other malformed input.
export const EMAIL_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const isValidEmail = email => EMAIL_RE.test(String(email || '').trim());

// The temp-mail services people actually reach for — a subset of the backend
// blocklist so obvious throwaways are caught instantly.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'yopmail.com',
  'throwawaymail.com', 'getnada.com', 'trashmail.com', 'maildrop.cc', 'moakt.com',
  'dispostable.com', 'fakeinbox.com', 'mohmal.com', '1secmail.com', 'discard.email',
  'dropmail.me', 'mailcatch.com', 'emailondeck.com', 'spam4.me', 'grr.la',
]);

// Returns a soft, user-facing message when the address is unusable, else null.
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
