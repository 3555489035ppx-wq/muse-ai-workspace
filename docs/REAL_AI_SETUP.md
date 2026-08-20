# Muse 真实 AI 接入说明

Muse 的真实生成链路已经接入服务端 BFF（Backend-for-Frontend，前端专用后端）。用户可以在“设置 → AI 服务 / API”中输入自己的 Provider（模型服务商）Key；浏览器脚本不会读取完整 Key，真实请求始终由服务端代理。

## 用户看到的完整闭环

1. 用户在新建项目中输入项目名称、设计目标、目标用户和使用场景。
2. Muse 先把输入整理成可确认的 Brief（设计简报）。
3. 用户确认后，按当前项目上下文生成研究证据、设计洞察、三个差异化方向、产品概念和 CMF（材料、色彩与表面处理）。
4. 用户必须先选择一个概念，再由已连接的 Text AI 生成 Visual Generation Brief，由已连接的 Image AI 生成四张互补产品图；选定一张后才能进入后续 CMF、评审、版本记录和封面。
5. 用户确认评审建议后创建版本，版本保留图片、变更原因和上游项目上下文。

真实 Text AI 关闭时，Muse 只保留用户输入与已经存在的结果，并明确显示离线状态，不会新生成本地替代内容；真实 Image AI 关闭时不生成图片，也不会把 SVG 或种子图片标记为外部模型结果。

## 本地连接自己的 API Key

本地开发时，运行 `pnpm dev` 会同时启动前端和 BFF。打开“设置 → AI 服务 / API”，选择 Text AI 或 Image AI，填写 Provider、模型 ID、Base URL，点击“添加 API Key”，然后点击“测试真实连接”或“保存配置”。完整 Key 只在当前页面内存中短暂存在，保存后由本地 BFF 写入 `.muse-runtime` 的加密密钥库；页面只会显示掩码后缀。

## 开启本地服务端默认 AI

复制 `.env.example` 为 `.env`，只在服务端填写密钥。服务端启动时会自动读取项目根目录的 `.env`，不需要把密钥写进浏览器环境变量：

```env
DEEPSEEK_API_KEY=你的 DeepSeek 服务端密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TEXT_MODEL=deepseek-v4-pro
DEEPSEEK_REASONING_EFFORT=max
OPENAI_API_KEY=你的 OpenAI 服务端密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_IMAGE_MODEL=gpt-image-2
MUSE_AI_LIVE_ENABLED=true
MUSE_AI_KILL_SWITCH=false
MUSE_AI_ALLOWED_PROJECT_IDS=允许使用真实 AI 的项目 UUID
MUSE_AI_REQUEST_BUDGET_CNY=1
MUSE_AI_PROJECT_DAILY_BUDGET_CNY=10
```

开发环境运行：

```bash
pnpm install
pnpm dev
```

生产环境先执行 `pnpm build`，再执行 `pnpm start`。生产入口会在同一个 Node 进程中提供 `dist/client` 和 `/api`，不需要把真实 AI 请求暴露给静态前端。

启动后先检查 `GET /api/ai/capabilities`：`providers.text.ready` 与 `providers.image.ready` 分别代表真实文本和真实图片链路，只有二者都为 `true` 才显示 REAL。部分就绪会显示 PARTIAL，不会把缺失能力显示为成功。

## 上线后让用户自己输入 Key

本仓库的 Sites 构建包含 `worker/index.js`，线上同源 `/api` 会直接由 Worker 处理，不再是只有静态文件的前端：

1. 在 Sites 运行时设置一个随机的 `MUSE_SITE_SECRET`，并设置 `MUSE_SITE_AI_ENABLED=true`；不要把用户的 Provider Key 写入站点环境变量。
2. 发布包含 Worker 的构建版本。
3. 用户打开线上站点的“设置 → AI 服务 / API”，输入自己的 Text AI 或 Image AI Key，测试并保存。

线上保存的是当前浏览器专属的 HttpOnly 加密会话 Cookie，服务端解密后才会向用户填写的 Provider 发起请求；完整 Key 不会返回到 React、导出 JSON、LocalStorage、URL 或运行记录。当前产品没有公共账号体系，因此这是“当前浏览器可恢复”的 BYOK（Bring Your Own Key，用户自带密钥），不是跨设备账号同步。若以后需要跨设备同步，应接入身份认证、D1 用户配置表和更严格的密钥保管服务，不能把 Key 明文放进数据库。

通用静态托管（例如 GitHub Pages）仍然不能承载这个 Worker API；只有部署了本仓库 Worker 的 Sites 或受控 Node BFF 才能支持线上真实连接。

服务端接口：

- `GET /api/ai/capabilities`：返回真实 AI 是否可用、模型名称、预算和能力。
- `GET /api/ai/providers`：读取当前浏览器的 Provider 配置视图，只返回掩码，不返回完整 Key。
- `PATCH /api/ai/providers/:category-provider`：保存用户的 Provider 配置。
- `POST /api/ai/providers/:category-provider/test`：真实调用 Provider 并返回连接状态。
- `POST /api/ai/structured`：生成 Brief、研究、方向、概念、CMF 和评审文字。
- `POST /api/ai/images/generate`：生成产品图片；图片由服务端下载、校验并以 Muse 资产地址返回。产品概念页点击“生成产品图”后会等待结果，成功后才保存；前端还会检查图片是否可加载且达到最低尺寸，质量不达标会拒绝覆盖现有结果并允许重试。
- `POST /api/ai/images/edit`：基于 Muse 已保存的父图执行 CMF 或评审受控编辑。
- `GET /api/ai/runs`：返回不含 Prompt、图片与密钥的安全运行元数据。

## 安全边界

- 不要使用 `VITE_` 前缀保存供应商密钥，也不要把 `.env` 提交到 GitHub。
- 生产环境必须填写 `MUSE_AI_ALLOWED_PROJECT_IDS`，默认拒绝所有未加入实验范围的项目。
- 每次请求有单次预算和项目日预算；供应商失败时保留已有结果，允许用户重试。
- 本地 BFF 的 AI Run、预算和 Provider 密钥写入 `.muse-runtime/`；线上 Worker 的 BYOK 配置使用浏览器专属加密会话，生成图片应绑定对象存储以获得跨请求资产地址，不能把完整 Key 放进前端或普通数据库字段。
- 真实图片结果会经过 HTTPS、MIME、大小和远程地址校验后才进入项目资产；浏览器保存前还会检查实际可加载性和最低分辨率。
- Overview、Brief、Research、Insight 与 Direction 不生成图片。第一张图只会出现在概念被用户确认以后，避免把 AI 视觉误当研究事实。

GitHub Pages 等纯静态托管只适合作为公开作品集展示；它们不会安全地承载供应商密钥。当前 Sites 构建已经把 `/api` 放进 Worker，可支持用户自带 Key；若使用其他静态托管，则只能查看已保存案例和离线数据，不执行真实 AI 生成。生产环境仍应配置鉴权、限流、预算和运行数据持久化。

## 发布前检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:sites
pnpm build
```

没有连接用户 Provider 时，`/api/ai/capabilities` 应明确返回未就绪；这属于安全的未配置状态。线上 Worker 必须配置 `MUSE_SITE_SECRET`，否则保存 Key 会返回配置错误。
