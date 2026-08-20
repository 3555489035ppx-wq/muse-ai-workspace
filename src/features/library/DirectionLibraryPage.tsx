import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderInput } from "lucide-react";
import { SearchInput } from "../../components/ui.jsx";
import { AppShell } from "../../components/shell.jsx";
import { Button, EmptyState, StatusPill, TagList } from "../../components/ui.jsx";
import { JINGANBAO_PROJECT_ID } from "../../data/jinganbao.js";

const curatedDirections = [
  { id: "jinganbao-care", scope: "项目内方向", title: "亲和照护", concept: "把夜间照护的单手连续操作放在第一位，以低压力握持、清晰反馈和家庭化比例建立信任。", narrative: "优先减少照护者的操作负担，而不是把产品做得更像医疗设备。", image: "/assets/jinganbao/direction-soft-care-v2.png", tags: ["母婴照护", "单手操作", "低压力"], source: "净安宝 · 访谈与居家观察", action: "project" },
  { id: "jinganbao-mobile", scope: "项目内方向", title: "移动工具", concept: "把提拿、收纳、台面放置和短途移动看成一条连续路径，优先消除携带时的中断。", narrative: "提手是移动系统的一部分，不是装饰性造型。", image: "/assets/jinganbao/direction-portable-utility-v2.png", tags: ["出行", "收纳", "稳定放置"], source: "净安宝 · 出行情境与结构比较", action: "project" },
  { id: "jinganbao-durable", scope: "项目内方向", title: "耐用设备", concept: "以易清洁的结构分区、耐磨触点和明确维护逻辑建立长期使用的可靠感。", narrative: "专业感来自可解释的结构和维护边界，不来自夸张性能承诺。", image: "/assets/jinganbao/direction-clean-professional-v2.png", tags: ["耐用", "易维护", "结构秩序"], source: "净安宝 · 结构研究与 CMF 建议", action: "project" },
  { id: "home-ritual", scope: "参考方向", title: "家居仪式感", concept: "将高频小电器从台面杂物转化为可长期摆放的生活物件。", narrative: "功能区仍清晰，但材料、收纳和噪声感首先与家居环境协调。", image: "/assets/templates/template-home-appliance-v1.png", tags: ["家居", "高频使用", "易清洁"], source: "家居小电器模板", action: "template" },
  { id: "calm-care", scope: "参考方向", title: "安心照护", concept: "用可预期的操作步骤、柔和触感和视觉层级降低照护场景中的焦虑。", narrative: "先识别照护者忙碌的身体状态，再定义产品的造型性格。", image: "/assets/templates/template-maternal-care-v1.png", tags: ["照护", "安心", "单手"], source: "母婴产品模板", action: "template" },
  { id: "quiet-tech", scope: "参考方向", title: "安静技术", concept: "让屏幕、传感器和实体控制形成可理解的层级，而不是把技术堆成装饰。", narrative: "用户需要看懂设备正在做什么，也需要知道何时需要自己决定。", image: "/assets/templates/template-smart-hardware-v1.png", tags: ["智能硬件", "信息层级", "实体交互"], source: "智能硬件模板", action: "template" },
  { id: "carry-continue", scope: "参考方向", title: "随行连续性", concept: "让产品在包内、移动中和目的地台面上保持同一套使用逻辑。", narrative: "便携不是缩小尺寸，而是减少每次移动所需的重新布置。", image: "/assets/templates/template-travel-product-v1.png", tags: ["出行", "携带", "场景切换"], source: "出行与随身产品模板", action: "template" },
  { id: "care-clarity", scope: "参考方向", title: "照护清晰度", concept: "用分区、收纳和状态反馈让健康照护物件更易理解、更容易坚持使用。", narrative: "复杂信息应在日常节奏中被逐步看见，而不是一次压给用户。", image: "/assets/templates/template-care-device-v1.png", tags: ["健康", "收纳", "状态反馈"], source: "健康与照护产品模板", action: "template" },
  { id: "material-evidence", scope: "参考方向", title: "材料证据感", concept: "用材料、触感、耐久与维护方式支持产品主张，而不是只换一套颜色。", narrative: "每个 CMF 选择都要回答：它改变了谁的使用判断，以及要怎么验证。", image: "/assets/templates/template-cmf-v1.png", tags: ["CMF", "耐用", "触感"], source: "CMF 材料与色彩模板", action: "template" },
  { id: "air-quality-ritual", scope: "参考方向", title: "安静的环境仪式", concept: "把空气状态、环境光和夜间节奏收进一件长期摆放的家居设备。", narrative: "减少屏幕和提示，让状态反馈成为空间中的低干扰线索。", image: "/assets/projects/air-quality-hub-v1.png", tags: ["环境感知", "家居融合", "低干扰反馈"], source: "工业设计方向 · 空气与光环境", action: "template" },
  { id: "travel-water-tool", scope: "参考方向", title: "随行的连续工具", concept: "用折叠结构连接收纳、展开、接水和饮用，让移动中的动作保持连续。", narrative: "便携不是缩小尺寸，而是降低每次重新布置的成本。", image: "/assets/projects/travel-water-purifier-v1.png", tags: ["移动工具", "折叠结构", "出行"], source: "工业设计方向 · 便携净水", action: "template" },
  { id: "warm-circular-device", scope: "参考方向", title: "温暖的循环设备", concept: "把餐厨回收变成饭后顺手完成的家庭节奏，而不是额外的环保任务。", narrative: "通过投放边界、抽屉取出和易清洁材料建立长期使用信心。", image: "/assets/projects/compost-processor-v1.png", tags: ["家庭循环", "易清洁", "生活方式"], source: "工业设计方向 · 餐厨循环", action: "template" },
  { id: "visible-storage-order", scope: "参考方向", title: "可见的储存秩序", concept: "用模块、透明材质和可见存量，让取用、补货与拆洗围绕同一套结构完成。", narrative: "材料本身承担信息层级，减少对额外应用和说明的依赖。", image: "/assets/projects/pantry-organizer-v1.png", tags: ["模块化", "可见存量", "拆洗维护"], source: "工业设计方向 · 模块化厨房", action: "template" },
] as const;

const projectDirectionImages: Record<string, string> = {
  "jinganbao-care": "/assets/jinganbao/concepts/concept-soft-care-v3.png",
  "jinganbao-mobile": "/assets/jinganbao/concepts/concept-travel-loop-v3.png",
  "jinganbao-durable": "/assets/jinganbao/concepts/concept-durable-service-v3.png",
};

export function DirectionLibraryPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const visible = curatedDirections.filter((record) => `${record.title}${record.concept}${record.tags.join("")}`.toLocaleLowerCase("zh-CN").includes(query.trim().toLocaleLowerCase("zh-CN")));

  return <AppShell><main className="direction-library-page" aria-labelledby="direction-library-title">
    <header className="library-heading"><div><p>面向产品概念的可比较策略</p><h1 id="direction-library-title">方向库</h1><span>项目内方向用于做当前选择；参考方向用于找到可复用的设计判断，而不是图片合集。</span></div><StatusPill status="ai">{curatedDirections.length} 个可比较方向</StatusPill></header>
    <div className="direction-library-toolbar"><SearchInput label="搜索方向" value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="搜索方向、场景或关键词" resultCount={visible.length} /></div>
    {visible.length === 0 ? <EmptyState title="没有匹配的方向" description="更换关键词后再试。" /> : <div className="direction-library-grid">{visible.map((record) => <article key={record.id}><img src={projectDirectionImages[record.id] ?? record.image} alt={`${record.title}方向的产品设计参考`} /><div><StatusPill status={record.scope === "项目内方向" ? "ai" : "default"}>{record.scope}</StatusPill><h2>{record.title}</h2><section className="direction-library-card__strategy"><span>设计策略</span><p>{record.concept}</p></section><blockquote><span>关键判断</span>{record.narrative}</blockquote><TagList items={record.tags} /><footer><span>参考来源</span><strong>{record.source}</strong></footer><div className="direction-library-actions"><Button icon={FolderInput} onClick={() => navigate(record.action === "project" ? `/projects/${JINGANBAO_PROJECT_ID}/direction` : "/templates")}>{record.action === "project" ? "在净安宝中比较" : "查看适用模板"}</Button></div></div></article>)}</div>}
  </main></AppShell>;
}
