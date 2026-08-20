# Muse Phase 0 Open Source Notices

本文件记录 Muse V3 Phase 0 实际采用或直接验证的开源依赖。版本来自当前 `pnpm-lock.yaml` / 已安装 package manifest；许可证标识来自各包的 `package.json` 与随包 LICENSE 文件。完整既有运行时依赖与架构参考另见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 和 [docs/OPEN_SOURCE_FOUNDATION.md](./docs/OPEN_SOURCE_FOUNDATION.md)。

## Runtime foundations

| Package | Resolved version | Phase 0 use | License | Upstream |
| --- | ---: | --- | --- | --- |
| `dexie` | 4.4.4 | 单一 IndexedDB schema、transaction、migration 与 Repository persistence | Apache-2.0 | <https://github.com/dexie/Dexie.js> |
| `zustand` | 5.0.14 | Thin frontend session store；不缓存领域实体全表 | MIT | <https://github.com/pmndrs/zustand> |
| `@xyflow/react` | 12.11.2 | CreativeDecisionMapShell 基础画布 | MIT | <https://github.com/xyflow/xyflow> |
| `@dnd-kit/core` | 6.3.1 | 通用 typed drag context 基础 | MIT | <https://github.com/clauderic/dnd-kit> |
| `@dnd-kit/sortable` | 10.0.0 | 既有 sortable 能力；Phase 0 不新增业务耦合 | MIT | <https://github.com/clauderic/dnd-kit> |

## Development and test foundations

| Package/tool | Resolved version | Phase 0 use | License | Upstream |
| --- | ---: | --- | --- | --- |
| TypeScript | 6.0.2 | strict typecheck 与 coverage 编译 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| ESLint | 9.39.2 | 静态检查 | MIT | <https://github.com/eslint/eslint> |
| typescript-eslint | 8.65.0 | TypeScript ESLint parser/config | MIT | <https://github.com/typescript-eslint/typescript-eslint> |
| `tsx` | 4.23.1 | Node Test Runner 的 TypeScript loader | MIT | <https://github.com/privatenumber/tsx> |
| `fake-indexeddb` | 6.2.5 | 真实 IndexedDB API 的隔离测试环境 | Apache-2.0 | <https://github.com/dumbmatter/fakeIndexedDB> |
| Node.js Test Runner / coverage | bundled with current Node runtime | 单一测试框架与核心 coverage threshold | Node.js license | <https://github.com/nodejs/node> |

Type declaration packages `@types/node@26.1.1`、`@types/react@19.2.17`、`@types/react-dom@19.2.3` 仅用于编译期类型，其各自 package manifest 标识为 MIT。

## Explicit boundaries

- Muse 没有复制上述项目源码；通过 npm package API 使用。
- tldraw 不属于 Phase 0 新采用路径。既有 adapter 继续隔离，生产使用必须满足 tldraw license key 要求。
- ComfyUI 不属于 Phase 0 provider。它仅作为既有、可选的外部服务协议参考，Muse 不复制其 GPL-3.0 源码。
- Phase 0 没有加入 OpenAI、Claude、Gemini、LangGraph、FLUX、Stable Diffusion、ComfyUI server、InvokeAI 或 Vision API SDK。
- 本清单不替代各上游项目的完整 LICENSE/NOTICE；再分发时应连同依赖安装产物中的许可证文本一并审计。

核对日期：`2026-07-28`。
