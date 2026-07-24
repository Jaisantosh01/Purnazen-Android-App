// Shared input validators so every form checks the same way.

// Proper address form: local@domain.tld with a real 2+ char TLD, no leading/
// trailing dots or consecutive dots in either part. Rejects "a@b", "x@y.c" and
// other malformed inputs that a loose \S+@\S+\.\S+ pattern lets through.
export const EMAIL_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const isValidEmail = email => EMAIL_RE.test(String(email || '').trim());

// Phone: format check only. Real ownership verification needs an OTP/SMS round
// trip (Firebase Phone Auth = paid SMS), so we validate the shape and leave
// verification out. Mirrors the backend UpdateProfileRequest.phone pattern.
export const PHONE_RE = /^[+0-9 ()-]{6,15}$/;

export const isValidPhone = phone => PHONE_RE.test(String(phone || '').trim());
