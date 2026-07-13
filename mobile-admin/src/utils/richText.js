import React from 'react';
import { Text, View } from 'react-native';

// Renderer for the lightweight HTML subset used by content pages
// (<b>/<strong>, <i>/<em>, <u>, <small>, <h1>-<h3>, <li>, <br>, <p>, <ul>/<ol>).
// Unknown or stray tags are stripped so raw markup is never shown to the user.

const INLINE_TAGS = {
  b: { fontWeight: '700' },
  strong: { fontWeight: '700' },
  i: { fontStyle: 'italic' },
  em: { fontStyle: 'italic' },
  u: { textDecorationLine: 'underline' },
  small: { fontSize: 11 },
};

const decodeEntities = (s) => s
  .replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

export const htmlToPlain = (html) =>
  html ? decodeEntities(String(html).replace(/<[^>]*>/g, '')) : '';

// Collapses the tag noise older editor versions produced (e.g. "</b><b>"
// between every character) and drops empty tag pairs.
export const normalizeHtml = (html) => {
  if (!html) return '';
  let result = String(html).replace(/\r\n/g, '\n');
  let prev;
  do {
    prev = result;
    result = result
      .replace(/<\/(b|strong|i|em|u|small|h1|h2|h3|li)><\1>/gi, '')
      .replace(/<(b|strong|i|em|u|small|h1|h2|h3|li)>\s*<\/\1>/gi, '');
  } while (result !== prev);
  return result;
};

const OPEN_INLINE_RE = /<(b|strong|i|em|u|small)(\s[^>]*)?>/i;

// Text with no supported opening tags left — strip any stray tags and decode.
const leafText = (text) => decodeEntities(text.replace(/<[^>]*>/g, ''));

// Recursively renders inline markup, accumulating styles so nesting
// (e.g. bold inside italic) works.
const renderInline = (text, inheritedStyle, keyPrefix) => {
  const out = [];
  let rest = text;
  let k = 0;

  while (rest.length > 0) {
    const m = rest.match(OPEN_INLINE_RE);
    if (!m) {
      const t = leafText(rest);
      if (t) out.push(<Text key={`${keyPrefix}_${k++}`} style={inheritedStyle}>{t}</Text>);
      break;
    }

    if (m.index > 0) {
      const before = leafText(rest.substring(0, m.index));
      if (before) out.push(<Text key={`${keyPrefix}_${k++}`} style={inheritedStyle}>{before}</Text>);
    }

    const tag = m[1].toLowerCase();
    const afterOpen = rest.substring(m.index + m[0].length);

    // Find the matching close tag, honoring nesting of the same tag.
    const pairRe = new RegExp(`<(/?)${tag}(\\s[^>]*)?>`, 'gi');
    let depth = 1;
    let closeIdx = -1;
    let closeLen = 0;
    let mm;
    while ((mm = pairRe.exec(afterOpen)) !== null) {
      depth += mm[1] === '/' ? -1 : 1;
      if (depth === 0) { closeIdx = mm.index; closeLen = mm[0].length; break; }
    }

    const inner = closeIdx === -1 ? afterOpen : afterOpen.substring(0, closeIdx);
    rest = closeIdx === -1 ? '' : afterOpen.substring(closeIdx + closeLen);

    const childStyle = [inheritedStyle, INLINE_TAGS[tag]];
    out.push(
      <Text key={`${keyPrefix}_${k++}`} style={childStyle}>
        {renderInline(inner, childStyle, `${keyPrefix}_${k}`)}
      </Text>
    );
  }

  return out;
};

const HEADING_SIZES = { h1: 22, h2: 20, h3: 18 };

/**
 * Renders the HTML subset into an array of React Native elements.
 * Block structure is line-based: a line starting with <h1>-<h3> becomes a
 * heading, <li> (or "- ") lines become bullets, a line wrapped in <small>
 * renders small, everything else is a paragraph with inline styling.
 */
export const renderRichText = (html, colors) => {
  if (!html) return null;

  const normalized = normalizeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|ul|ol)(\s[^>]*)?>/gi, '\n');

  const baseStyle = { color: colors.textPrimary, fontSize: 14, lineHeight: 22 };
  const elements = [];
  let listBuffer = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const rows = listBuffer;
    listBuffer = [];
    elements.push(
      <View key={`list_${key++}`} style={{ marginLeft: 8, marginBottom: 6 }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
            <Text style={[baseStyle, { marginRight: 6 }]}>{'•'}</Text>
            <Text style={[baseStyle, { flex: 1 }]}>{row}</Text>
          </View>
        ))}
      </View>
    );
  };

  normalized.split('\n').forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      // Preserve intentional blank lines as paragraph spacing
      if (idx > 0) elements.push(<View key={`sp_${key++}`} style={{ height: 6 }} />);
      return;
    }

    const liMatch = trimmed.match(/^(?:<li(?:\s[^>]*)?>|-\s)/i);
    if (liMatch) {
      const inner = trimmed.replace(/<\/?li(\s[^>]*)?>/gi, '').replace(/^-\s/, '');
      listBuffer.push(renderInline(inner, baseStyle, `li_${idx}`));
      return;
    }

    flushList();

    const headingMatch = trimmed.match(/^<(h[1-3])(\s[^>]*)?>/i);
    if (headingMatch) {
      const tag = headingMatch[1].toLowerCase();
      const inner = trimmed.replace(/<\/?h[1-3](\s[^>]*)?>/gi, '');
      const headingStyle = {
        ...baseStyle,
        fontSize: HEADING_SIZES[tag],
        lineHeight: HEADING_SIZES[tag] + 10,
        fontWeight: '700',
        marginTop: 8,
        marginBottom: 4,
      };
      elements.push(
        <Text key={`h_${key++}`} style={headingStyle}>
          {renderInline(inner, headingStyle, `h_${idx}`)}
        </Text>
      );
      return;
    }

    const isSmallLine = /^<small(\s[^>]*)?>/i.test(trimmed) && /<\/small>$/i.test(trimmed);
    const lineStyle = isSmallLine ? { ...baseStyle, fontSize: 11, lineHeight: 16 } : baseStyle;
    const inner = isSmallLine ? trimmed.replace(/^<small(\s[^>]*)?>/i, '').replace(/<\/small>$/i, '') : trimmed;

    elements.push(
      <Text key={`p_${key++}`} style={[lineStyle, { marginBottom: 2 }]}>
        {renderInline(inner, lineStyle, `p_${idx}`)}
      </Text>
    );
  });

  flushList();
  return elements;
};
