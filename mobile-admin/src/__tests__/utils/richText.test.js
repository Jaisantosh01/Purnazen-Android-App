import { htmlToPlain, normalizeHtml, renderRichText } from '../../utils/richText';

const colors = { textPrimary: '#111' };

// Recursively collect the raw strings rendered inside an element tree.
const collectText = (node, out = []) => {
  if (node == null || node === false) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(n => collectText(n, out));
    return out;
  }
  if (node.props) collectText(node.props.children, out);
  return out;
};

const renderedText = (html) => collectText(renderRichText(html, colors)).join('');

describe('htmlToPlain', () => {
  it('strips tags and decodes entities', () => {
    expect(htmlToPlain('<b>Hi</b> &amp; <i>bye</i>')).toBe('Hi & bye');
  });

  it('handles empty input', () => {
    expect(htmlToPlain('')).toBe('');
    expect(htmlToPlain(null)).toBe('');
  });
});

describe('normalizeHtml', () => {
  it('merges the per-character tag spam the old editor produced', () => {
    expect(normalizeHtml('<b>H</b><b>e</b><b>y</b>')).toBe('<b>Hey</b>');
  });

  it('drops empty tag pairs', () => {
    expect(normalizeHtml('before<b></b>after')).toBe('beforeafter');
  });
});

describe('renderRichText', () => {
  it('never renders raw tags', () => {
    const html = '<h3>Title</h3>\n<b>bold</b> and <i>italic</i>\n<li>point one</li>\n<small>fine print</small>\n<unknown>kept text</unknown>';
    const text = renderedText(html);
    expect(text).toContain('Title');
    expect(text).toContain('bold');
    expect(text).toContain('italic');
    expect(text).toContain('point one');
    expect(text).toContain('fine print');
    expect(text).toContain('kept text');
    expect(text).not.toMatch(/<[^>]*>/);
  });

  it('handles nested and unclosed tags without leaking markup', () => {
    const text = renderedText('<b>bold <i>both</i></b> tail\n<b>unclosed');
    expect(text).toContain('both');
    expect(text).toContain('unclosed');
    expect(text).not.toMatch(/<[^>]*>/);
  });

  it('returns null for empty content', () => {
    expect(renderRichText('', colors)).toBeNull();
    expect(renderRichText(null, colors)).toBeNull();
  });
});
