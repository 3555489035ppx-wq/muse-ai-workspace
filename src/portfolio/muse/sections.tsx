import { ArrowDown, ArrowUpRight, Check, Minus } from "lucide-react";
import { aiFlow, iterations, productScreens, workflow } from "./content";
import {
  AmbientShadow,
  BrowserFrame,
  ChromeFrame,
  ContactShadow,
  DetailCrop,
  FloatingWindow,
  NoiseLayer,
  PerspectiveStage,
  PhysicalDisplay,
  PhysicalMacbook,
  PortfolioCaption,
  SafariFrame,
  ScreenshotLayer,
  ScreenshotStack,
} from "./mockups";

const projectRoute = "/projects/f1000000-0000-4000-8000-000000000101/overview";

function SectionHeading({ index, eyebrow, title, copy }: { index: string; eyebrow: string; title: string; copy?: string }) {
  return (
    <header className="mp-heading" data-reveal>
      <span className="mp-heading__index">{index}</span>
      <div>
        <p className="mp-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {copy ? <p className="mp-heading__copy">{copy}</p> : null}
      </div>
    </header>
  );
}
export function HeroSection() {
  return (
    <section className="mp-scene mp-hero" id="cover" data-export-name="01-hero">
      <NoiseLayer />
      <div className="mp-hero__copy" data-reveal>
        <div className="mp-kicker"><span>AI PRODUCT DESIGN</span><span>2026</span></div>
        <h1>Muse</h1>
        <p className="mp-hero__line">把创意工作从零散生成，变成可追溯的设计决策系统。</p>
        <div className="mp-hero__meta">
          <span>Product strategy</span><span>AI interaction</span><span>UX architecture</span><span>Frontend prototype</span>
        </div>
      </div>
      <PerspectiveStage preset="hero" className="mp-hero__visual" data-reveal>
        <AmbientShadow /><ContactShadow />
        <BrowserFrame label="静境空气灯塔 / Direction">
          <ScreenshotLayer src={productScreens.direction} alt="Muse 方向工作台真实界面，展示三条可比较的产品方向" fetchPriority="high" />
        </BrowserFrame>
      </PerspectiveStage>
      <a className="mp-scroll-cue" href="#context"><span>Case study</span><ArrowDown aria-hidden="true" /></a>
    </section>
  );
}

export function ContextSection() {
  return (
    <section className="mp-section mp-context" id="context">
      <SectionHeading index="01" eyebrow="Context" title="AI 让生成更快，却没有让设计决策更清楚。" />
      <div className="mp-context__body" data-reveal>
        <p className="mp-lede">创意团队同时使用文档、白板、聊天和生成工具。速度提升了，但证据、判断与版本被拆散在不同界面里。</p>
        <dl className="mp-facts">
          <div><dt>Project</dt><dd>AI 创意方向工作台</dd></div>
          <div><dt>Role</dt><dd>产品策略 · AI 交互 · UX/UI · 原型</dd></div>
          <div><dt>Scope</dt><dd>从 Brief 到 Decision Map 的核心闭环</dd></div>
          <div><dt>Output</dt><dd>可运行 Web 产品与完整 Case Study</dd></div>
        </dl>
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="mp-scene mp-problem" id="problem" data-export-name="02-problem">
      <SectionHeading index="02" eyebrow="Problem" title="真正丢失的不是灵感，而是上下文。" copy="当 AI 只输出一段看起来合理的答案，设计师仍然不知道它基于什么、为什么值得选择、下一步如何继续。" />
      <div className="mp-problem__grid" data-reveal>
        <div className="mp-problem__statement"><span>01</span><p>研究证据无法进入后续方向判断。</p></div>
        <div className="mp-problem__statement"><span>02</span><p>AI 输出缺少差异、风险和取舍。</p></div>
        <div className="mp-problem__statement"><span>03</span><p>评审意见与版本演变无法追溯。</p></div>
      </div>
      <PerspectiveStage preset="flat" className="mp-problem__visual" data-reveal>
        <ChromeFrame label="Fragmented creative context">
          <ScreenshotLayer src={productScreens.brief} alt="Muse 项目 Brief 界面，展示结构化项目上下文" />
        </ChromeFrame>
      </PerspectiveStage>
    </section>
  );
}

export function OpportunitySection() {
  return (
    <section className="mp-section mp-opportunity" id="opportunity">
      <SectionHeading index="03" eyebrow="Opportunity" title="让 AI 维护决策上下文，而不是替设计师做决定。" />
      <blockquote data-reveal>“AI 的价值不在于一次生成更多，而在于持续理解：我们为什么走到这里。”</blockquote>
      <div className="mp-opportunity__shift" data-reveal>
        <div><span>FROM</span><strong>Prompt → Answer</strong><p>一次性的内容生成</p></div>
        <ArrowUpRight aria-hidden="true" />
        <div><span>TO</span><strong>Evidence → Decision</strong><p>连续的设计判断</p></div>
      </div>
    </section>
  );
}

export function StrategySection() {
  return (
    <section className="mp-scene mp-strategy" id="strategy" data-export-name="03-strategy">
      <SectionHeading index="04" eyebrow="Product strategy" title="一条可回看、可比较、可继续的设计链。" />
      <div className="mp-strategy__system" data-reveal>
        <ol className="mp-chain">
          <li><span>01</span><strong>Evidence</strong><small>事实与约束</small></li>
          <li><span>02</span><strong>Insight</strong><small>模式与机会</small></li>
          <li><span>03</span><strong>Direction</strong><small>策略与取舍</small></li>
          <li><span>04</span><strong>Concept</strong><small>形式与表达</small></li>
          <li><span>05</span><strong>Decision</strong><small>评审与版本</small></li>
        </ol>
        <p className="mp-strategy__principle">每个输出引用上游依据；每个关键决定需要 Human-in-the-loop（人在回路）确认；确认结果成为下一阶段上下文。</p>
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section className="mp-section mp-workflow" id="workflow">
      <SectionHeading index="05" eyebrow="Workflow" title="从模糊问题到明确决定。" copy="产品结构不按工具分类，而按设计师真正推进工作的顺序组织。" />
      <ol className="mp-workflow__list" data-reveal>
        {workflow.map((item) => <li key={item.number}><span>{item.number}</span><div><strong>{item.title}</strong><em>{item.zh}</em></div><p>{item.copy}</p></li>)}
      </ol>
    </section>
  );
}

export function EvidenceSection() {
  return (
    <section className="mp-scene mp-evidence" id="evidence" data-export-name="04-evidence-stack">
      <SectionHeading index="06" eyebrow="Evidence" title="先让判断有依据。" copy="访谈、竞品、材料与限制被统一成可引用的 Evidence，而不是散落在附件和聊天记录里。" />
      <ScreenshotStack className="mp-evidence__stack" data-reveal>
        <PerspectiveStage preset="evidence"><FloatingWindow label="Evidence workspace"><ScreenshotLayer src={productScreens.evidence} alt="Muse Evidence 页面，展示结构化研究证据" /></FloatingWindow></PerspectiveStage>
        <DetailCrop src={productScreens.evidence} alt="Evidence 页面中的用户信号细节" position="74% 35%" />
        <DetailCrop src={productScreens.evidence} alt="Evidence 页面中的约束和机会细节" position="73% 73%" />
      </ScreenshotStack>
      <PortfolioCaption index="06.1" eyebrow="Grounding before generation">AI 先读取证据与限制，再生成下一阶段内容。</PortfolioCaption>
    </section>
  );
}

export function InsightSection() {
  return (
    <section className="mp-scene mp-insight" id="insight" data-export-name="05-insight">
      <SectionHeading index="07" eyebrow="Insight" title="把长答案变成可判断的结构。" copy="Insight 不追求文字更多，而是呈现信号、依据、机会与风险。" />
      <div className="mp-insight__layout" data-reveal>
        <PerspectiveStage preset="flat"><SafariFrame label="Insight synthesis"><ScreenshotLayer src={productScreens.insight} alt="Muse Insight 页面，展示结构化洞察与引用" /></SafariFrame></PerspectiveStage>
        <ol className="mp-annotation-list">
          <li><span>01</span><p><strong>Signal</strong> 用户或市场发生了什么。</p></li>
          <li><span>02</span><p><strong>Why it matters</strong> 为什么值得进入设计判断。</p></li>
          <li><span>03</span><p><strong>Trace</strong> 结论来自哪些 Evidence。</p></li>
        </ol>
      </div>
    </section>
  );
}

export function DirectionHeroSection() {
  return (
    <section className="mp-scene mp-direction" id="direction" data-export-name="06-direction-hero">
      <SectionHeading index="08" eyebrow="Direction" title="比较差异，而不是比较形容词。" copy="每条方向都明确战略差异、核心原则、适用条件与 Trade-off（取舍）。" />
      <PerspectiveStage preset="direction" className="mp-direction__hero" data-reveal>
        <AmbientShadow /><ContactShadow />
        <BrowserFrame label="Direction comparison"><ScreenshotLayer src={productScreens.direction} alt="Muse Direction 页面，三条方向并列比较" /></BrowserFrame>
      </PerspectiveStage>
    </section>
  );
}

export function DirectionComparisonSection() {
  const columns = [
    { name: "静谧地标", difference: "用克制体量建立空间中心", tradeoff: "识别强，但必须避免纪念碑感", state: "Primary" },
    { name: "环境融入", difference: "弱化设备感，响应周围光线", tradeoff: "更亲和，但品牌辨识更依赖细节", state: "Alternative" },
    { name: "可见机制", difference: "让空气状态直接成为形式", tradeoff: "信息明确，但容易显得过度技术化", state: "Explore" },
  ];
  return (
    <section className="mp-scene mp-comparison" id="direction-comparison" data-export-name="07-direction-comparison">
      <SectionHeading index="08.1" eyebrow="Strategic difference" title="三条路必须真正不同。" />
      <div className="mp-comparison__grid" data-reveal>
        {columns.map((column, index) => <article key={column.name} className={index === 0 ? "is-primary" : ""}><span>{column.state}</span><h3>{column.name}</h3><dl><div><dt>Difference</dt><dd>{column.difference}</dd></div><div><dt>Trade-off</dt><dd>{column.tradeoff}</dd></div></dl>{index === 0 ? <Check aria-label="选择为主方向" /> : <Minus aria-hidden="true" />}</article>)}
      </div>
      <DetailCrop className="mp-comparison__crop" src={productScreens.direction} alt="Direction 的战略差异与取舍细节" position="78% 52%" />
    </section>
  );
}

export function ConceptSection() {
  return (
    <section className="mp-scene mp-concept" id="concept" data-export-name="08-concept">
      <SectionHeading index="09" eyebrow="Concept" title="方向确认后，AI 才进入形式探索。" copy="概念、CMF 与视觉语言共享同一条已确认方向，减少无边界发散。" />
      <ScreenshotStack className="mp-concept__stack" data-reveal>
        <PerspectiveStage preset="concept"><ChromeFrame label="Concept exploration"><ScreenshotLayer src={productScreens.concept} alt="Muse Concept 页面，展示从方向进入概念探索" /></ChromeFrame></PerspectiveStage>
        <DetailCrop src={productScreens.material} alt="Muse CMF 页面中的材料策略细节" position="75% 55%" />
      </ScreenshotStack>
    </section>
  );
}

export function AIArchitectureSection() {
  return (
    <section className="mp-section mp-ai" id="ai-architecture">
      <SectionHeading index="10" eyebrow="AI architecture" title="不是一个聊天框，而是一套阶段化 AI Flow（AI 流程）。" />
      <div className="mp-ai__flow" data-reveal>
        {aiFlow.map(([term, description], index) => <div key={term}><span>{String(index + 1).padStart(2, "0")}</span><strong>{term}</strong><p>{description}</p></div>)}
      </div>
    </section>
  );
}

export function IterationSection() {
  return (
    <section className="mp-section mp-iteration" id="iteration">
      <SectionHeading index="11" eyebrow="Iteration" title="三次关键调整，解决三个真实问题。" />
      <ol className="mp-iteration__list" data-reveal>
        {iterations.map((item, index) => <li key={item.issue}><span>{String(index + 1).padStart(2, "0")}</span><div><p className="mp-iteration__label">Observed</p><strong>{item.issue}</strong></div><div><p className="mp-iteration__label">Changed</p><strong>{item.change}</strong></div><div><p className="mp-iteration__label">Result</p><strong>{item.effect}</strong></div></li>)}
      </ol>
    </section>
  );
}

export function ReviewSection() {
  return (
    <section className="mp-scene mp-review" id="review" data-export-name="09-review">
      <SectionHeading index="12" eyebrow="Review" title="反馈不离开作品，建议不覆盖决定。" copy="评审意见绑定到具体对象；AI 负责归纳冲突与遗漏，设计师决定是否采纳。" />
      <div className="mp-review__layout" data-reveal>
        <PerspectiveStage preset="flat"><BrowserFrame label="Review workspace"><ScreenshotLayer src={productScreens.review} alt="Muse Review 页面，展示评审意见与 AI 归纳" /></BrowserFrame></PerspectiveStage>
        <DetailCrop src={productScreens.review} alt="Review 页面中的评审建议细节" position="79% 54%" />
      </div>
    </section>
  );
}

export function VersionSection() {
  return (
    <section className="mp-scene mp-version" id="version" data-export-name="10-version">
      <SectionHeading index="13" eyebrow="Version" title="看见作品如何改变，也看见为什么改变。" />
      <div className="mp-version__compare" data-reveal>
        <div><span>BEFORE / EXPLORATION</span><DetailCrop src={productScreens.concept} alt="概念探索阶段的方案" position="67% 49%" /></div>
        <div><span>AFTER / DECISION</span><DetailCrop src={productScreens.version} alt="评审后的版本与差异记录" position="72% 52%" /></div>
      </div>
      <p className="mp-version__note">版本不是文件副本，而是「变化内容 + 变化原因 + 决策人」的记录。</p>
    </section>
  );
}

export function DecisionMapSection() {
  return (
    <section className="mp-scene mp-map" id="decision-map" data-export-name="11-decision-map">
      <SectionHeading index="14" eyebrow="Decision map" title="最终交付不是一组页面，而是一条可解释的路径。" />
      <div className="mp-map__window" data-reveal>
        <BrowserFrame label="Decision trace / full project"><ScreenshotLayer src={productScreens.decisionMap} alt="Muse Decision Map 长页面，串联证据、洞察、方向、概念和决定" /></BrowserFrame>
        <div className="mp-map__legend"><span>Evidence</span><span>Insight</span><span>Direction</span><span>Concept</span><span>Decision</span></div>
      </div>
    </section>
  );
}

export function FinalSystemSection() {
  return (
    <section className="mp-scene mp-final" id="final-system" data-export-name="12-final-system">
      <NoiseLayer />
      <div className="mp-final__copy" data-reveal>
        <p className="mp-eyebrow">Final system</p>
        <h2>From prompt fragments<br />to design decisions.</h2>
        <p>一个可运行的 AI 创意方向工作台，覆盖 Brief、Evidence、Insight、Direction、Concept、Review、Version 与 Decision Map。</p>
        <a href={projectRoute}>Open the product <ArrowUpRight aria-hidden="true" /></a>
      </div>
      <div className="mp-final__devices" data-reveal>
        <PhysicalDisplay src={productScreens.direction} alt="桌面显示器中的 Muse Direction 页面" />
        <PhysicalMacbook src={productScreens.decisionMap} alt="笔记本电脑中的 Muse Decision Map 页面" />
      </div>
    </section>
  );
}

export function ReflectionSection() {
  return (
    <section className="mp-section mp-reflection" id="reflection">
      <SectionHeading index="15" eyebrow="Reflection" title="AI 产品的完成度，不应只看模型输出。" />
      <div className="mp-reflection__body" data-reveal>
        <p>这次设计让我更确定：AI UX 的核心是设计输入、上下文、确认机制与失败状态。模型负责扩大探索，产品负责保持连续性，设计师负责最终判断。</p>
        <div><span>Next</span><p>下一阶段将用真实设计任务验证：方向比较是否更快、引用链是否足够清楚，以及 Decision Map 是否能支持跨角色评审。</p></div>
      </div>
    </section>
  );
}
