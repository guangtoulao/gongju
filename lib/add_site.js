'use strict';
// 加站助手核心：detect（识别前端框架/主题） + generate（套模板生成 drpy2 rule 与 site 条目）
const { TEMPLATES, ORDER } = require('./drpy2_templates.js');
const gen = require('./yunduo_generator.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function normalizeOrigin(input) {
  if (!input) return null;
  input = String(input).trim();
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  try {
    return new URL(input).origin;
  } catch (e) {
    return null;
  }
}

async function fetchWithTimeout(url, opts = {}, timeout = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

function slugify(host) {
  const base = host.split('.').slice(0, -1).join('_');
  return (base.replace(/[^a-z0-9_]/gi, '_') || host.replace(/[^a-z0-9_]/gi, '_'));
}

async function fetchHome(origin) {
  try {
    const res = await fetchWithTimeout(origin + '/', { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
    const html = await res.text();
    return { status: res.status, html };
  } catch (e) {
    return { status: 0, html: '', error: String(e && e.message || e) };
  }
}

function fetchTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]+?)<\/title>/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  return '';
}

// 识别苹果CMS 前端主题：统计各模板 detect.classes 在首页 HTML 中的命中数量
function detectTheme(html) {
  let best = null;
  let bestScore = 0;
  for (const name of ORDER) {
    if (name === '默认') continue;
    const tpl = TEMPLATES[name];
    const classes = (tpl.detect && tpl.detect.classes) || [];
    let score = 0;
    for (const c of classes) {
      if (html.includes(c)) score += 1;
    }
    // 路径特征作为加分
    const paths = (tpl.detect && tpl.detect.paths) || [];
    for (const p of paths) {
      if (html.includes(p)) score += 2;
    }
    if (score > bestScore) { bestScore = score; best = name; }
  }
  return bestScore > 0 ? best : null;
}

async function detectYunduo(origin) {
  // 复用云朵生成器的检测逻辑：命中 App 接口即视为 yunduo-app
  try {
    const r = await gen.build(origin, '');
    if (r && r.type === 'yunduo-app') return true;
  } catch (e) {}
  return false;
}

// 判断响应体是否符合苹果CMS provide/vod 的 JSON 结构
function isAppleJson(text) {
  try {
    const o = JSON.parse(text);
    if (typeof o !== 'object' || o === null) return false;
    return 'code' in o && Array.isArray(o.list) &&
      ('total' in o || 'pagecount' in o || 'limit' in o || 'page' in o);
  } catch (e) {
    return false;
  }
}

// 当首页无明确前端主题时，再探一下苹果CMS 标准 provide/vod 接口，避免把普通网页误判成影视站
async function probeAppleProvide(origin) {
  const cands = [
    '/api.php/provide/vod/', '/index.php/api/provide/vod/',
    '/index.php/provide/vod/', '/provide/vod/'
  ];
  for (const p of cands) {
    try {
      const res = await fetchWithTimeout(origin + p + '?ac=list&pg=1', {
        headers: { 'User-Agent': UA, Accept: 'application/json,*/*' }
      });
      if (res.status === 404 || res.status === 403) continue;
      const text = await res.text();
      if (isAppleJson(text)) return true;
    } catch (e) {}
  }
  return false;
}

async function detect(input) {
  const origin = normalizeOrigin(input);
  if (!origin) return { ok: false, framework: 'error', message: '网址无效，请检查（可带或不带 http://）。' };
  let host = '';
  try { host = new URL(origin).host; } catch (e) {
    return { ok: false, framework: 'error', message: '无法解析主机名。' };
  }

  const home = await fetchHome(origin);
  const title = home.html ? fetchTitle(home.html) : '';
  const theme = home.html ? detectTheme(home.html) : null;

  // 云朵 App 接口站点
  if (await detectYunduo(origin)) {
    return {
      ok: true, framework: 'yunduo-app', host, title, origin, theme: null,
      themes: ORDER,
      message: '检测到云朵类 App 接口站，走 csp_App3Q 风格（需你 jar 内置 App3Q，并补全 finger/sk）。'
    };
  }

  if (theme) {
    return {
      ok: true, framework: 'applecms', host, title, origin, theme,
      themes: ORDER,
      message: '识别为苹果CMS 标准站，前端主题「' + TEMPLATES[theme].label + '」，已套对应模板生成 rule。'
    };
  }

  // 首页不可达，或无明显主题
  if (!home.html) {
    return {
      ok: false, framework: 'unknown', host, title, origin, theme: null, themes: ORDER,
      message: '首页不可达（网络/超时/拦截），无法自动识别主题。可手动选择模板后生成。'
    };
  }
  // 首页可达但无前端主题：再探苹果CMS 标准接口，命中才算影视站
  if (await probeAppleProvide(origin)) {
    return {
      ok: true, framework: 'applecms', host, title, origin, theme: '默认', themes: ORDER,
      message: '检测到苹果CMS 标准接口，但首页未匹配到具体前端主题，已按「默认」模板生成骨架，请在 TVBox 里微调 url/searchUrl/选择器。'
    };
  }
  return {
    ok: false, framework: 'unknown', host, title, origin, theme: null, themes: ORDER,
    message: '首页可达但未识别为影视站（无苹果CMS 接口/前端特征），可能是普通网页。如需仍生成，可手动选择模板后点“用此模板重新生成”。'
  };
}

// 将模板字段渲染为明文 JS rule 文本
function renderRule(opts) {
  const { name, host, theme } = opts;
  const tpl = TEMPLATES[theme] || TEMPLATES['默认'];
  const J = (v) => JSON.stringify(v); // 字符串统一双引号，JS 引擎兼容
  const lines = [];
  lines.push('var rule = {');
  lines.push('  title: ' + J(name) + ',');
  lines.push('  host: ' + J(host) + ',');
  lines.push('  url: ' + J(tpl.url) + ',');
  lines.push('  searchUrl: ' + J(tpl.searchUrl) + ',');
  lines.push('  searchable: ' + (tpl.searchable != null ? tpl.searchable : 2) + ',');
  lines.push('  quickSearch: ' + (tpl.quickSearch != null ? tpl.quickSearch : 0) + ',');
  lines.push('  filterable: ' + (tpl.filterable != null ? tpl.filterable : 0) + ',');
  if (tpl.timeout) lines.push('  timeout: ' + tpl.timeout + ',');
  if (tpl.cate_exclude) lines.push('  cate_exclude: ' + J(tpl.cate_exclude) + ',');
  lines.push('  headers: ' + J(tpl.headers || { 'User-Agent': 'MOBILE_UA' }) + ',');
  if (tpl.class_parse) lines.push('  class_parse: ' + J(tpl.class_parse) + ',');
  lines.push('  play_parse: ' + (tpl.play_parse != null ? tpl.play_parse : true) + ',');
  lines.push('  lazy: ' + J(tpl.lazy != null ? tpl.lazy : '') + ',');
  lines.push('  limit: ' + (tpl.limit != null ? tpl.limit : 6) + ',');
  lines.push('  double: ' + (tpl.double != null ? tpl.double : true) + ',');
  if (tpl.推荐) lines.push('  推荐: ' + J(tpl.推荐) + ',');
  if (tpl.一级) lines.push('  一级: ' + J(tpl.一级) + ',');
  if (tpl.二级 != null) lines.push('  二级: ' + JSON.stringify(tpl.二级, null, 2).replace(/\n/g, '\n  ') + ',');
  if (tpl.搜索) lines.push('  搜索: ' + J(tpl.搜索) + ',');
  lines.push('  template: ' + J(theme) + '');
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

// 生成 type:3 的 site 条目（drpy2 引擎 + rule 文件），与用户 api.json 风格一致
function renderSiteEntry(name, fileName, origin) {
  const entry = {
    key: slugify(new URL(origin).host),
    name: name,
    type: 3,
    api: './lib/drpy2.min.js',
    ext: './lib/' + fileName,
    searchable: 1,
    quickSearch: 1,
    filterable: 1
  };
  return entry;
}

// 云朵类：生成 csp_App3Q 风格条目（对齐用户现有体系，finger/sk 需按站补全）
function renderYunduoEntry(name, origin) {
  const host = origin;
  const entry = {
    key: slugify(new URL(origin).host),
    name: name,
    type: 3,
    api: 'csp_App3Q',
    ext: {
      host: host,
      finger: 'SF-在此填入该站finger',
      updateId: '在此填入updateId',
      deviceBrand: 'vivo',
      deviceModel: 'V2309A',
      pkg: 'com.tvcloud.io',
      sk: 'SK-在此填入该站sk',
      ver: '1'
    }
  };
  return entry;
}

async function generate(opts) {
  const { url, name, theme, target } = opts;
  const origin = normalizeOrigin(url);
  if (!origin) return { ok: false, message: '网址无效。' };
  const host = new URL(origin).host;
  const siteName = (name && name.trim()) || '';

  // 云朵分支
  if (theme === 'yunduo-app' || (!theme && (await detectYunduo(origin)))) {
    const entry = renderYunduoEntry(siteName || host, origin);
    return {
      ok: true, framework: 'yunduo-app', target: target || 'api',
      fileName: null,
      ruleText: '',
      siteEntry: entry,
      siteEntryText: JSON.stringify(entry, null, 2),
      message: '云朵类 App 站：已生成 csp_App3Q 风格条目。请把 finger/sk/updateId 按该站抓包补全，并确保你的 custom_spider.jar 已内置 App3Q。'
    };
  }

  const t = theme && TEMPLATES[theme] ? theme : '默认';
  const fileName = slugify(host) + '.js';
  const ruleText = renderRule({ name: siteName || host, host: origin, theme: t });
  const entry = renderSiteEntry(siteName || host, fileName, origin);

  return {
    ok: true, framework: 'applecms', target: target || 'api',
    fileName, ruleText,
    siteEntry: entry,
    siteEntryText: JSON.stringify(entry, null, 2),
    message: '已生成 drpy2 rule（模板：' + TEMPLATES[t].label + '）。把 rule 存为 lib/' + fileName +
      '，把 site 条目加进 ' + (target || 'api') + '.json 的 sites 数组即可。'
  };
}

module.exports = { detect, generate, TEMPLATES, ORDER, slugify };
