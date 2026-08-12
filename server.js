'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const gen = require('./lib/yunduo_generator.js');
const addSite = require('./lib/add_site.js');

const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');

// 苹果 CMS（AppleCMS）常见的 provide/vod 端点候选
const CANDIDATES = [
  '/api.php/provide/vod/',
  '/api.php/provide/vod',
  '/index.php/api/provide/vod/',
  '/index.php/api/provide/vod',
  '/index.php/provide/vod/',
  '/provide/vod/',
  '/api.php/maccms/provide/vod/'
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function normalizeOrigin(input) {
  if (!input) return null;
  input = String(input).trim();
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  let u;
  try {
    u = new URL(input);
  } catch (e) {
    return null;
  }
  // 只保留 scheme + host（origin 不含末尾斜杠）
  return u.origin;
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

// 判断响应体是否符合苹果 CMS provide/vod 的 JSON 结构
function isAppleJson(text) {
  try {
    const o = JSON.parse(text);
    if (typeof o !== 'object' || o === null) return false;
    const hasCode = 'code' in o;
    const hasList = Array.isArray(o.list);
    const hasTotalish =
      'total' in o || 'pagecount' in o || 'limit' in o || 'page' in o;
    // 必须同时有 code 和 list 数组，且带分页/总数特征
    return hasCode && hasList && hasTotalish;
  } catch (e) {
    return false;
  }
}

async function probeEndpoint(origin, p) {
  // 先试 V10 (ac=list -> type 3)，再试旧版 (ac=videolist -> type 2)
  const variants = [
    { version: 'v10', type: 3, ac: 'list' },
    { version: 'legacy', type: 2, ac: 'videolist' }
  ];
  for (const v of variants) {
    const url = origin + p + '?ac=' + v.ac + '&pg=1';
    try {
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json,*/*' }
      });
      if (res.status === 404 || res.status === 403) continue;
      const text = await res.text();
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json') || isAppleJson(text)) {
        if (isAppleJson(text)) {
          return { ok: true, api: origin + p, type: v.type, version: v.version };
        }
      }
    } catch (e) {
      // 该候选失败，继续下一个 ac 变体
    }
  }
  return { ok: false };
}

async function fetchTitle(origin) {
  try {
    const res = await fetchWithTimeout(origin + '/', { headers: { 'User-Agent': UA } });
    const html = await res.text();
    const m = html.match(/<title[^>]*>([\s\S]+?)<\/title>/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  } catch (e) {
    // ignore
  }
  return '';
}

function slugify(host) {
  const base = host.split('.').slice(0, -1).join('_');
  const cleaned = base.replace(/[^a-z0-9_]/gi, '_');
  return cleaned || host.replace(/[^a-z0-9_]/gi, '_');
}

async function probe(input) {
  const origin = normalizeOrigin(input);
  if (!origin) {
    return { ok: false, error: '网址无效，请检查后重试（可带或不带 http://）。' };
  }

  let host = '';
  try {
    host = new URL(origin).host;
  } catch (e) {
    return { ok: false, error: '无法解析主机名。' };
  }

  const slug = slugify(host);
  const title = await fetchTitle(origin);

  let found = null;
  for (const p of CANDIDATES) {
    const r = await probeEndpoint(origin, p);
    if (r.ok) {
      found = r;
      break;
    }
  }

  if (!found) {
    return {
      ok: false,
      origin,
      host,
      title,
      message:
        '未检测到苹果 CMS 标准 provide/vod 接口。\n' +
        '该站很可能是自定义前端（例如带 WASM 解码的 SPA，像之前分析的“云朵影视”），' +
        '它的 /api.php/web/ 接口与 TVBox 要求的 /provide/vod/ 协议不兼容。\n' +
        '这类站点无法自动生成 JSON，需要单独为其编写 TVBox spider（爬虫）才能接入。'
    };
  }

  const config = {
    spider: '',
    sites: [
      {
        key: slug,
        name: title || host,
        type: found.type,
        api: found.api,
        playUrl: '',
        searchable: 1,
        quickSearch: 1,
        filterable: 1
      }
    ],
    rules: {},
    flags: [],
    parse: [],
    live: []
  };

  return {
    ok: true,
    origin,
    host,
    title,
    version: found.version,
    type: found.type,
    api: found.api,
    config
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');

  // 云平台健康检查端点（Railway / Render / Fly.io 等常用 /healthz 或 / 探活）
  if (parsedUrl.pathname === '/healthz' || parsedUrl.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/probe') {
    const url = parsedUrl.searchParams.get('url');
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '缺少 url 参数' }, null, 2));
    }
    try {
      const result = await probe(url);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }, null, 2));
    }
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/yunduo') {
    const url = parsedUrl.searchParams.get('url');
    const spiderUrl = parsedUrl.searchParams.get('spider') || '';
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '缺少 url 参数' }, null, 2));
    }
    try {
      const result = await gen.build(url, spiderUrl);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }, null, 2));
    }
  }

  // 加站助手：输入任意影视站，识别前端主题/框架，准备套模板生成
  if (req.method === 'GET' && parsedUrl.pathname === '/api/detect') {
    const url = parsedUrl.searchParams.get('url');
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ framework: 'error', message: '缺少 url 参数' }, null, 2));
    }
    try {
      const result = await addSite.detect(url);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ framework: 'error', message: String(e && e.message || e) }, null, 2));
    }
  }

  // 加站助手：套模板生成 drpy2 rule 文件文本 + type:3 site 条目
  if (req.method === 'GET' && parsedUrl.pathname === '/api/generate') {
    const url = parsedUrl.searchParams.get('url');
    const name = parsedUrl.searchParams.get('name') || '';
    const theme = parsedUrl.searchParams.get('theme') || '';
    const target = parsedUrl.searchParams.get('target') || 'api';
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, message: '缺少 url 参数' }, null, 2));
    }
    try {
      const result = await addSite.generate({ url, name, theme, target });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, message: String(e && e.message || e) }, null, 2));
    }
  }

  if (req.method === 'GET' && (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500);
      return res.end('index.html not found');
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  return res.end('not found');
});

server.listen(PORT, () => {
  console.log('TVBox 探针已启动: http://localhost:' + PORT);
});
