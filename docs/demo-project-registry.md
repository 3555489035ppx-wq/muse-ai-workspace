# Muse V4.2 Demo Project Registry

V4.2 的工业设计项目是可运行的作品集 Demo，不是随机项目列表。项目、内容、素材和后续工作流必须在同一个 projectId 下闭环；任何没有注册的项目都不能进入 V4.2 Demo Portfolio。

## Public entry strategy

The default product path features **谷仓鲜度轨** as the single complete case. The other seeded projects remain registered for regression coverage and can be re-enabled for internal testing, but they are hidden from the public project list so a reviewer can understand one complete workflow without choice overload.

## Approved projects

| projectId | 项目 | 产品类型 | 素材根路径 | 种子来源 |
| --- | --- | --- | --- | --- |
| `f1000000-0000-4000-8000-000000000104` | 谷仓鲜度轨 | 模块化厨房收纳 | `/assets/portfolio/granary-fresh-rail-v2` | `src/data/industrialPortfolioContent.js` | Featured demo |
| `f1000000-0000-4000-8000-000000000001` | 净安宝 | 便携式多功能消毒器 | `/assets/jinganbao/v2` | `src/data/jinganbao.js` | Hidden supporting seed |
| `f1000000-0000-4000-8000-000000000101` | 静境空气灯塔 | 家居环境设备 | `/assets/portfolio/quiet-air-lighthouse-v2` | `src/data/industrialPortfolioContent.js` | Hidden supporting seed |
| `f1000000-0000-4000-8000-000000000103` | 回收餐厨器 | 家庭循环设备 | `/assets/portfolio/kitchen-loop-reclaimer-v2` | `src/data/industrialPortfolioContent.js` | Hidden supporting seed |

`f1000000-0000-4000-8000-000000000102`（行旅净水舱）是 retired 项目，不属于 V4.2 四项目 Demo 集合，也不能作为列表、工作区或视觉素材的回退项。

## Workflow contract

每个注册项目都必须有：

- 5 条带来源和限制说明的研究证据；
- 5 条由证据支撑的设计洞察；
- 3 个设计方向、9 个产品概念、3 个 CMF 方案；
- 至少 1 条设计评审、3 个版本记录和决策地图状态；
- `projectOverview`、已确认 `designBrief`、`researchWorkspace` 和 `industrial` 的持久化记录。

工作流选择必须保持上下游关系：方向只能引用本项目洞察，概念只能引用当前方向，CMF 只能绑定当前概念，版本和评审只能读取当前项目已选视觉与上游证据。

## Demo Visual boundary

V4.2 的概念图、CMF 图和版本图由 `DemoVisualProvider` 从项目专属本地素材派生。它们的记录必须包含：

- `imageSource: "demo-asset"`；
- `visualMode: "demo-asset"`；
- 当前 `projectId`、上游 `directionId` / `conceptId` / `cmfId`；
- 可读的 `rationale` 和 `visualDescription`。

Demo Visual 不是 OpenAI Image API 的结果，界面不得显示 `REAL`、GPT Image 或其他会误导用户的付费图像 Provider 标签。真实文字 AI 仍可用于结构化 Brief、研究解读、洞察、方向、概念、CMF、评审和版本说明；图片生成 Provider 保留给未来真实图像服务接入。

## Verification

执行：

```bash
npm run test:industrial
```

其中 `tests/industrial/v42-demo-workflow.test.mjs` 会校验注册表、工作流数量、素材存在性、项目隔离、图片去重和文字与视觉的上游关联。
