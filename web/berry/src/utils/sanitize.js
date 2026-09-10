import DOMPurify from 'dompurify';

/**
 * 安全的 HTML 净化工具，用于防止存储型 XSS。
 * 所有通过 dangerouslySetInnerHTML 渲染的内容必须经过本模块净化。
 * 与 air/default 主题保持同一套安全策略（三主题一致）。
 */

// 允许的标签（在 DOMPurify 默认基础上扩展）
const ALLOWED_TAGS = [
  // 默认常用标签
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
  'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'video', 'audio', 'source',
  'iframe',
  'details', 'summary',
  'sub', 'sup',
  'mark', 'small',
  'abbr', 'cite',
  'dl', 'dt', 'dd',
  'figure', 'figcaption',
  'input', // 仅 checkbox/radio 展示用
];

// 允许的属性
const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id',
  'width', 'height', 'style',
  'target', 'rel',
  'frameborder', 'allowfullscreen', 'allow',
  'colspan', 'rowspan',
  'controls', 'autoplay', 'loop', 'muted', 'poster',
  'type', 'checked', 'disabled',
  'start', 'reversed',
  'datetime',
  'download',
  'loading',
  'referrerpolicy',
  'sandbox',
];

// 允许的 URI 协议（防止 javascript: 等危险协议）
const ALLOWED_URI_REGEXP = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

/**
 * 净化 HTML 字符串，移除所有危险标签和属性。
 * @param {string} html - 待净化的 HTML
 * @param {object} options - 额外选项
 * @returns {string} 净化后的 HTML
 */
export function sanitizeHTML(html, options = {}) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_ATTR: ['target', 'rel', 'sandbox'],
    FORBID_TAGS: ['script', 'style', 'link', 'meta', 'form', 'button', 'select', 'textarea', 'object', 'embed', 'applet', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress', 'onmousedown', 'onmouseup', 'onmousemove', 'onmouseout', 'ondblclick', 'oncontextmenu', 'onwheel', 'onscroll', 'onresize', 'onhashchange', 'onmessage', 'onstorage', 'onpopstate', 'onbeforeunload', 'onunload', 'onpageshow', 'onpagehide', 'ononline', 'onoffline', 'onfocusin', 'onfocusout', 'oninput', 'oninvalid', 'onreset', 'onsearch', 'onselect', 'ontoggle', 'onwaiting', 'onplay', 'onpause', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange'],
    ...options,
  };

  return DOMPurify.sanitize(html, config);
}

/**
 * 净化 Markdown 解析后的 HTML。
 * marked 库在 v4+ 已移除内置 sanitize 选项，必须手动净化。
 * @param {string} markdownHTML - marked.parse() 的输出
 * @returns {string} 净化后的 HTML
 */
export function sanitizeMarkdown(markdownHTML) {
  return sanitizeHTML(markdownHTML, {
    ADD_ATTR: ['target', 'rel', 'class', 'id'],
  });
}

/**
 * 校验 URL 是否安全（用于 iframe src、a href 等）。
 * 仅允许 http/https/mailto/tel 协议。
 * @param {string} url - 待校验的 URL
 * @returns {boolean} 是否安全
 */
export function isSafeUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 安全地设置 iframe src，仅允许 https 协议的 URL。
 * @param {string} url - 待设置的 URL
 * @returns {string} 安全的 URL 或空字符串
 */
export function safeIframeSrc(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  if (!url.startsWith('https://')) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    // ignore
  }
  return '';
}

export default {
  sanitizeHTML,
  sanitizeMarkdown,
  isSafeUrl,
  safeIframeSrc,
};
