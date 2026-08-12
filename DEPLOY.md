# 部署说明（TVBox 加站助手）

这是一个**纯 Node.js** 后端服务（无任何第三方依赖，仅用内置模块）。
只要你部署的目标平台支持 Node >= 18（全局 `fetch` / `AbortController` 需要），就能跑。

## 核心文件（部署只需这些）
- `server.js` —— HTTP 服务入口
- `lib/add_site.js` —— 加站核心：识别前端主题 + 套模板生成
- `lib/drpy2_templates.js` —— drpy2 前端模板库
- `lib/yunduo_generator.js` —— 云朵类 App 接口站生成
- `public/index.html` —— 前端页面

> 目录里其它 `decode_*.js` / `glue_*.js` / `app_spider_test.js` / `config*.json` 都是开发期调试产物，部署时可不传。

## 端口与环境变量
- 服务读取 `process.env.PORT`，没有则默认 `8787`。**云平台会自动注入 `PORT`，无需手动改代码。**
- 监听地址为 `0.0.0.0`（全部网卡），云平台可直接从外部访问。
- 健康检查端点：`GET /healthz` 或 `GET /ping` 返回 `ok`。

## 启动命令
```
npm install   # 无依赖，秒过
npm start     # 等价于 node server.js
```

## 各平台速配

### Railway
1. New Project → Deploy a Node.js repo（或上传本目录 / 连 Git 仓库）。
2. Railway 自动识别 `package.json` 的 `start` 脚本并注入 `PORT`。
3. 默认域名即可访问；健康检测可留空（Railway 用 `/`）。

### Render
1. New → Web Service，连你的仓库或手动上传。
2. Build Command：`npm install`（可留空）。Start Command：`npm start`。
3. 在 Health Check Path 填 `/healthz`。
4. 选一个免费/付费实例，部署完给 `.onrender.com` 域名。

### Fly.io
1. `fly launch`（会自动生成 `fly.toml`，监听 `PORT`）。
2. `fly deploy`。
3. 健康检查在 `fly.toml` 里配 `[[services.http_checks]] path = "/healthz"`。

### 任意 VPS / 云服务器
```
git clone <你的仓库> && cd tvbox-probe
npm install && npm start
# 建议前面套一层 Nginx 反代 + HTTPS，再暴露 443
```

## 重要注意
- **探测功能依赖服务器能访问外网**：服务会主动去抓你输入的影视站首页 / 接口来识别框架。绝大多数云平台出网正常；若部署在严格受限的网络（部分 Serverless 封闭出网），识别会失败。
- 浏览器端只调用同源的 `/api/detect` 与 `/api/generate`，部署后无需改前端。
- 生成的 rule 文件与 site 条目最终要回到你**本地**的 TVBox 配置体系（`spider.jar` + `lib/` + `*.json`），平台本身不碰你的本地配置。
