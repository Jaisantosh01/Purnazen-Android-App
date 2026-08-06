import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';

const pad2 = v => (String(v).length === 1 ? `0${v}` : String(v));

// Split an ISO date ("YYYY-MM-DD") into { dd, mm, yyyy } parts for the inputs.
export const isoToParts = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return { dd: '', mm: '', yyyy: '' };
  return { dd: m[3], mm: m[2], yyyy: m[1] };
};

// Validate { dd, mm, yyyy }. All-empty is treated as valid with no date, since
// date of birth is optional; anything partially filled must be a real past date.
export const validateDobParts = ({ dd = '', mm = '', yyyy = '' } = {}) => {
  if (!dd && !mm && !yyyy) return { ok: true, iso: undefined };
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  const now = new Date();
  if (!d || !mo || !y || String(yyyy).length !== 4) return { ok: false };
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { ok: false };
  if (y < 1900 || y > now.getFullYear()) return { ok: false };
  const dob = new Date(y, mo - 1, d);
  if (dob > now) return { ok: false };
  return { ok: true, iso: `${y}-${pad2(mm)}-${pad2(dd)}` };
};

/**
 * One DD / MM / YYYY box. The hint is drawn as an overlay instead of the
 * TextInput's own `placeholder`: on Android a centred empty field with a native
 * placeholder parks the caret after the hint (at the right edge).
 *
 * The input is centred by the box's own `justifyContent`, not by an overlay:
 * an absolutely-filled wrapper sized itself to the input and pinned it to the
 * top of the box, which left the date sitting ~10dp above the separators. The
 * hint overlay gets an explicit `height: '100%'` for the same reason. The hint
 * is keyed on `value` only, not on focus: hiding it the instant the field was
 * tapped is what read as a flicker.
 */
const Box = ({ styles, hint, boxStyle, inputRef, value, onChange, maxLength }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, boxStyle, focused && styles.boxFocused]}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={maxLength}
        textAlign="center"
        underlineColorAndroid="transparent"
      />
      {!value ? (
        <View style={styles.hintWrap} pointerEvents="none">
          <Text style={styles.placeholder} allowFontScaling={false}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
};

/**
 * Controlled date-of-birth entry. `value` is { dd, mm, yyyy } strings and
 * `onChange` receives the next object. Use validateDobParts(value) to check it
 * and isoToParts(iso) to seed it from a stored date.
 */
export default function DobInput({ value, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { dd = '', mm = '', yyyy = '' } = value || {};

  const mmRef = useRef(null);
  const yyyyRef = useRef(null);

  const set = patch => onChange({ dd, mm, yyyy, ...patch });

  return (
    <View style={styles.row}>
      <Box
        styles={styles}
        hint="DD"
        value={dd}
        maxLength={2}
        onChange={t => {
          const v = t.replace(/[^0-9]/g, '').slice(0, 2);
          set({ dd: v });
          if (v.length === 2) mmRef.current?.focus();
        }}
      />
      <Text style={styles.sep}>/</Text>
      <Box
        styles={styles}
        hint="MM"
        inputRef={mmRef}
        value={mm}
        maxLength={2}
        onChange={t => {
          const v = t.replace(/[^0-9]/g, '').slice(0, 2);
          set({ mm: v });
          if (v.length === 2) yyyyRef.current?.focus();
        }}
      />
      <Text style={styles.sep}>/</Text>
      <Box
        styles={styles}
        hint="YYYY"
        boxStyle={styles.year}
        inputRef={yyyyRef}
        value={yyyy}
        maxLength={4}
        onChange={t => set({ yyyy: t.replace(/[^0-9]/g, '').slice(0, 4) })}
      />
    </View>
  );
}

// The input and the hint share every metric that affects where a glyph lands,
// so a change to one has to be mirrored in the other. Both are laid out at
// GLYPH_BOX tall and flex-centred inside BOX_HEIGHT, so the typed date and the
// hint occupy exactly the same rectangle.
//
// Deliberately no `lineHeight`: Android renders it through a line-height span
// that pins the glyph to the bottom of the line box rather than its middle, so
// on a TextInput it drags the typed date below centre no matter how the box
// around it is aligned. Without it the font's own metrics decide, and
// `textAlignVertical` centres those inside GLYPH_BOX.
const BOX_HEIGHT = 44;
const GLYPH_BOX = 20;
const GLYPH = {
  fontSize: 15,
  fontWeight: '600',
  includeFontPadding: false, // Android: drop the font's built-in leading
  textAlign: 'center',
  textAlignVertical: 'center',
};

const makeStyles = colors => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 44 matches the text inputs elsewhere in the profile form. `justifyContent`
  // is what actually centres the date: laying the input out as a normal flex
  // child of the box is reliable, whereas an absolutely-filled wrapper sized
  // itself to the input and left it stuck to the top edge.
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  boxFocused: { borderColor: colors.primary },
  year: { flex: 1.4 },
  // `height: '100%'` resolves against the box's content height, so the hint is
  // centred over exactly the span the input is centred in — don't rely on
  // top/bottom to stretch this, that is the bug the input just came from.
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...GLYPH,
    width: '100%',
    height: GLYPH_BOX,
    color: colors.textPrimary,
    padding: 0,
  },
  placeholder: {
    ...GLYPH,
    width: '100%',
    height: GLYPH_BOX,
    color: colors.textMuted,
    padding: 0,
  },
  // includeFontPadding is off here too, otherwise the slash is centred inside a
  // taller box than the digits are and lands a couple of pixels low.
  sep: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
