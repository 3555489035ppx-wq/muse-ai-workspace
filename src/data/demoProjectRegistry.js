import { DEMO_PROJECT_IDS, isDemoPortfolioProject } from "./demoVisuals.js";

export const DEMO_PROJECT_REGISTRY = Object.freeze([
  {
    id: "f1000000-0000-4000-8000-000000000001",
    name: "净安宝",
    domain: "industrial",
    productType: "便携式多功能消毒器",
    seedSource: "src/data/jinganbao.js",
    assetRoot: "/assets/jinganbao/v2",
  },
  {
    id: "f1000000-0000-4000-8000-000000000101",
    name: "静境空气灯塔",
    domain: "industrial",
    productType: "家居环境设备",
    seedSource: "src/data/industrialPortfolioContent.js",
    assetRoot: "/assets/portfolio/quiet-air-lighthouse-v2",
  },
  {
    id: "f1000000-0000-4000-8000-000000000103",
    name: "回收餐厨器",
    domain: "industrial",
    productType: "家庭循环设备",
    seedSource: "src/data/industrialPortfolioContent.js",
    assetRoot: "/assets/portfolio/kitchen-loop-reclaimer-v2",
  },
  {
    id: "f1000000-0000-4000-8000-000000000104",
    name: "谷仓鲜度轨",
    domain: "industrial",
    productType: "模块化厨房收纳",
    seedSource: "src/data/industrialPortfolioContent.js",
    assetRoot: "/assets/portfolio/granary-fresh-rail-v2",
  },
]);

export function getDemoProjectRegistryEntry(projectId) {
  return DEMO_PROJECT_REGISTRY.find((item) => item.id === projectId) ?? null;
}

export { DEMO_PROJECT_IDS, isDemoPortfolioProject };
