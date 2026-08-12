/*
 * yunduo_generator.js —— “输入网址→出配置” 工具骨架的核心逻辑（Node 端）
 * 设计：yunduo 框架站点分两条路
 *   A) /api.php/app/*  App 接口：纯 JSON + SHA256 头签名，无需 wasm → 直接套模板（本文件主逻辑）
 *   B) /api.php/web/*  Web 前端：wasm + 二进制 protobuf 加密 → 退 wasm 方案（detectWeb 仅做识别，生成交给 yunduo_spider.js 手工/另写）
 *
 * 本模块只负责“探测 + 生成 config.json”，不负责托管 spider 文件。
 */

const crypto = require("crypto");

// yunduo 框架级常量（各镜像站通用，来源：能用的 App3Q 蜘蛛/配置）
const DEFAULT_EXT = {
  finger: "SF-F5F11CB15897115AE6BCFE063C288F730CA865588F572C780A3E8477D0DD3776",
  pkg: "com.tvcloud.io",
  sk: "SK-sk_13oXDZ7u9j2Tk1c0cawWVFfO",
  ver: "1",
  deviceBrand: "vivo",
  deviceModel: "V2309A"
};

// 复刻 App3Q.m395b()：构造带 x-sign 的请求头
function signHeaders(host, ext) {
  ext = Object.assign({}, DEFAULT_EXT, ext || {});
  const time = String(Math.floor(Date.now() / 1000));
  const nonce = String(Math.floor(Math.random() * 999) + 1);
  const raw = "finger=" + ext.finger + "&id=" + ext.pkg + "&nonce=" + nonce +
    "&sk=" + ext.sk + "&time=" + time + "&v=" + ext.ver;
  const sign = crypto.createHash("sha256").update(raw).digest("hex").toUpperCase();
  return {
    "user-agent": "okhttp/4.12.0",
    "accept": "application/json",
    "x-platform": "android",
    "x-ave": ext.ver,
    "x-aid": ext.pkg,
    "x-time": time,
    "x-nonc": nonce,
    "x-sign": sign,
    "x-device-id": "0b4328287a5d953e",
    "x-device-brand": ext.deviceBrand,
    "x-device-model": ext.deviceModel,
    "x-update-id": host
  };
}

function normalizeHost(input) {
  if (!input) return "";
  let h = input.trim();
  if (!/^https?:\/\//i.test(h)) h = "https://" + h;
  return h.replace(/\/+$/, "");
}

// 探测 App 接口：带签名打 /api.php/app/index/home，识别 yunduo 特征 JSON
async function detectApp(host) {
  try {
    const r = await fetch(host + "/api.php/app/index/home", { headers: signHeaders(host, DEFAULT_EXT) });
    if (r.status !== 200) return { ok: false, reason: "home status " + r.status };
    const o = JSON.parse(await r.text());
    if (o && o.code === 200 && o.data && Array.isArray(o.data.categories)) {
      return { ok: true, name: "yunduo-app", categories: o.data.categories.length, recommend: (o.data.recommend || []).length };
    }
    return { ok: false, reason: "JSON 形态不符（无 data.categories）" };
  } catch (e) {
    return { ok: false, reason: "请求异常: " + e.message };
  }
}

// 探测 Web 前端路径（仅识别，用于决定走 wasm 兜底）
async function detectWeb(host) {
  try {
    const r = await fetch(host + "/", { headers: { "user-agent": "Mozilla/5.0" } });
    const html = await r.text();
    // yunduo web 前端常见特征：assets 下有 web_app_wasm / index-*.js 这类打包名
    const hasWasm = /web_app_wasm_bg-[\w-]+\.wasm/.test(html) || /assets\/index-[\w]+\.js/.test(html);
    return { ok: hasWasm, reason: hasWasm ? "疑似 yunduo web/wasm 前端" : "未发现 web_app_wasm 特征" };
  } catch (e) {
    return { ok: false, reason: "请求异常: " + e.message };
  }
}

// 生成 type:1 配置（App 模板）。spiderUrl 由调用方提供（托管后的蜘蛛网址）
function generateConfig(host, spiderUrl) {
  const ext = Object.assign({ host: host }, DEFAULT_EXT);
  return {
    spider: spiderUrl || "<在此填入你托管 yunduo_app_spider.js 的网址>",
    sites: [
      {
        key: "yunduo",
        name: "云朵影视",
        type: 1,
        api: host,
        searchable: 1,
        quickSearch: 1,
        filterable: 0,
        ext: JSON.stringify(ext)
      }
    ],
    rules: {},
    parses: [],
    flags: [],
    ua: "okhttp/4.12.0"
  };
}

// 一键流程：探测 → 返回 {type, config?, ...}
async function build(input, spiderUrl) {
  const host = normalizeHost(input);
  if (!host) return { type: "error", message: "无效网址" };
  const app = await detectApp(host);
  if (app.ok) {
    return { type: "yunduo-app", host: host, detect: app, config: generateConfig(host, spiderUrl) };
  }
  const web = await detectWeb(host);
  if (web.ok) {
    return {
      type: "yunduo-web",
      host: host,
      detect: web,
      message: "检测到 web/wasm 加密前端，需 wasm 方案（yunduo_spider.js），本骨架暂未自动生成，请手工接 wasm 分支。"
    };
  }
  return { type: "unknown", host: host, message: "未识别为 yunduo 框架，可能不是该框架站点。" };
}

module.exports = { DEFAULT_EXT, signHeaders, normalizeHost, detectApp, detectWeb, generateConfig, build };
