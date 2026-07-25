import {
  parseCoordinates,
  validateClinicLocation,
  isValidLatitude,
  isValidLongitude,
  mapsUrl,
} from '../../utils/geo';

describe('parseCoordinates', () => {
  it('reads a bare "lat, long" pair', () => {
    expect(parseCoordinates('12.9716, 77.5946')).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
    });
  });

  it('reads a space-separated pair and negative values', () => {
    expect(parseCoordinates('-33.8688 151.2093')).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it('reads the ?q= form', () => {
    expect(parseCoordinates('https://maps.google.com/?q=12.9716,77.5946')).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
    });
  });

  it('reads the /@ viewport form', () => {
    expect(
      parseCoordinates('https://www.google.com/maps/@12.9716,77.5946,15z'),
    ).toEqual({ latitude: 12.9716, longitude: 77.5946 });
  });

  it('prefers the !3d/!4d pin over the /@ viewport centre', () => {
    const url =
      'https://www.google.com/maps/place/Clinic/@12.9,77.5,17z/data=!3m1!4b1!4m5!3m4!1s0x0:0x0!8m2!3d12.9716!4d77.5946';
    expect(parseCoordinates(url)).toEqual({ latitude: 12.9716, longitude: 77.5946 });
  });

  it('ignores numbers embedded in an address', () => {
    expect(parseCoordinates('123 MG Road, Bangalore 560001')).toBeNull();
  });

  it('rejects out-of-range values', () => {
    expect(parseCoordinates('99.5, 200.1')).toBeNull();
  });

  it('returns null for empty or non-string input', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('   ')).toBeNull();
    expect(parseCoordinates(null)).toBeNull();
    expect(parseCoordinates(undefined)).toBeNull();
  });

  it('returns null for an unresolvable short link', () => {
    expect(parseCoordinates('https://maps.app.goo.gl/abc123')).toBeNull();
  });
});

describe('validateClinicLocation', () => {
  it('accepts both blank (location is optional)', () => {
    expect(validateClinicLocation('', '')).toBeNull();
    expect(validateClinicLocation(null, undefined)).toBeNull();
  });

  it('accepts a valid pair, as string or number', () => {
    expect(validateClinicLocation('12.9716', '77.5946')).toBeNull();
    expect(validateClinicLocation(12.9716, 77.5946)).toBeNull();
  });

  it('rejects only one of the two being filled', () => {
    expect(validateClinicLocation('12.9716', '')).toMatch(/both/i);
    expect(validateClinicLocation('', '77.5946')).toMatch(/both/i);
  });

  it('rejects out-of-range and non-numeric values', () => {
    expect(validateClinicLocation('91', '77.5')).toMatch(/Latitude/);
    expect(validateClinicLocation('12.9', '181')).toMatch(/Longitude/);
    expect(validateClinicLocation('abc', '77.5')).toMatch(/Latitude/);
  });
});

describe('range guards', () => {
  it('bounds latitude and longitude', () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(90.1)).toBe(false);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(-180.1)).toBe(false);
    expect(isValidLatitude(NaN)).toBe(false);
  });
});

describe('mapsUrl', () => {
  it('builds a search deep link', () => {
    expect(mapsUrl(12.9716, 77.5946)).toBe(
      'https://www.google.com/maps/search/?api=1&query=12.9716,77.5946',
    );
  });
});
