// Phone: format check only. Mirrors the backend UpdateProfileRequest.phone pattern.
export const PHONE_RE = /^[+0-9 ()-]{6,10}$/;

export const isValidPhone = phone => PHONE_RE.test(String(phone || '').trim());

const cleanDigits = raw => raw?.replace(/[^0-9]/g, '') || '';

export const formatPhone = raw => {
  const d = cleanDigits(raw);
  if (!d) return '\u2014';
  const num = d.length >= 10 ? d.slice(-10) : d;
  return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
};

export const dialablePhone = raw => {
  const d = cleanDigits(raw);
  if (!d) return '';
  const num = d.length >= 10 ? d.slice(-10) : d;
  return `+91${num}`;
};
