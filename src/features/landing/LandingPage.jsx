import { useState } from "react";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import "./landing.css";

const navigation = [
  { label: "产品", href: "#product" },
  { label: "工作流", href: "#workflow" },
  { label: "案例", href: "#examples" },
  { label: "更新", href: "#changelog" },
  { label: "定价", href: "#pricing" },
  { label: "关于", href: "#about" },
];

const workflow = [
  {
    name: "理解",
    label: "需求简报",
    output: "把需求整理成可以确认的设计简报。",
  },
  {
    name: "研究",
    label: "研究证据",
    output: "收集来源，保留事实和上下文。",
  },
  {
    name: "洞察",
    label: "设计洞察",
    output: "从证据中提炼真正影响方向的判断。",
  },
  {
    name: "方向",
    label: "方向探索",
    output: "比较不同策略，明确取舍与风险。",
  },
  {
    name: "概念",
    label: "概念生成",
    output: "围绕已选方向进入视觉候选。",
  },
  {
    name: "决策",
    label: "方案决策",
    output: "接受、修改或拒绝，并留下版本关系。",
  },
];

const aiFlow = [
  ["输入", "你的问题", "需求、目标用户、交付物和限制。"],
  ["上下文", "项目上下文", "研究来源、参考素材、已确认的简报。"],
  ["处理", "AI 做整理", "归纳、比较、解释，并指出还缺少什么。"],
  ["输出", "可操作结果", "洞察、方向、概念或一条明确的下一步。"],
  ["人工确认", "由你确认", "编辑、保留、排除或创建新的迭代分支。"],
];

const changeLog = [
  ["先有简报", "从一条模糊需求开始，先确认问题，再让后续工作有共同上下文。"],
  ["证据保留", "研究来源、视觉参考和设计判断不会在生成后消失。"],
  ["决策相连", "每一个选中的方向都能回到它的依据，也能进入下一轮探索。"],
];

function LandingNav({ menuOpen, onToggle, onClose }) {
  return (
    <header className="landing-nav">
      <Link className="landing-brand" to="/" aria-label="返回 Muse 首页" onClick={onClose}>
        <img className="landing-brand__wordmark" src="/assets/brand/muse-handwritten-wordmark.jpg" alt="Muse" />
      </Link>

      <nav className={`landing-nav__links${menuOpen ? " is-open" : ""}`} aria-label="主导航">
        {navigation.map((item) => (
          <a key={item.label} href={item.href} onClick={onClose}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="landing-nav__actions">
        <Link className="landing-nav__login" to="/account" onClick={onClose}>
          登录
        </Link>
        <Link className="landing-button landing-button--small landing-button--light" to="/projects" onClick={onClose}>
          进入工作台
          <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.8} />
        </Link>
      </div>

      <button
        className="landing-menu-toggle"
        type="button"
        aria-label={menuOpen ? "关闭导航" : "打开导航"}
        aria-expanded={menuOpen}
        onClick={onToggle}
      >
        {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>
    </header>
  );
}

function GoddessVisual() {
  return (
    <figure
      className="landing-goddess-visual"
      aria-label="Muse 女神视觉，表达从灵感到设计方向的转化"
    >
      <div className="landing-goddess-visual__frame">
        <picture>
          <source media="(max-width: 640px)" srcSet="/assets/brand/muse-goddess-hero-mobile.webp" type="image/webp" />
          <source srcSet="/assets/brand/muse-goddess-hero.webp" type="image/webp" />
          <img
            src="/assets/brand/muse-goddess-hero.webp"
            alt="Muse 女神肖像，位于深色背景与蓝紫光影中"
            width="828"
            height="825"
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </div>
    </figure>
  );
}

function WorkflowSection() {
  return (
    <section className="landing-section landing-workflow" id="workflow" aria-labelledby="workflow-title">
      <div className="landing-section__heading">
        <p className="landing-section__kicker">设计决策链</p>
        <h2 id="workflow-title">每一步都有来处，也都有下一步。</h2>
        <p>
          Muse 把设计工作拆成可以理解、可以回看、可以继续推进的判断节点。AI 负责加速整理，人负责确认方向。
        </p>
      </div>

      <ol className="landing-workflow__track">
        {workflow.map((step) => (
          <li key={step.name} className="landing-workflow__step">
            <span className="landing-workflow__node" aria-hidden="true" />
            <strong>{step.name}</strong>
            <h3>{step.label}</h3>
            <p>{step.output}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="landing-page">
      <div className="landing-shell">
        <LandingNav
          menuOpen={menuOpen}
          onToggle={() => setMenuOpen((current) => !current)}
          onClose={closeMenu}
        />

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">AI 驱动的创意决策工作台</p>
            <h1 id="landing-title">
              <span>让模糊的想法，</span>
              <span>成为清晰的设计方向</span>
            </h1>
            <p className="landing-hero__description">
              Muse 帮助设计师从需求理解出发，整理研究、洞察和方向，让每一个设计决定都有上下文。
            </p>
            <div className="landing-hero__actions">
              <Link className="landing-button landing-button--light" to="/projects/new">
                开始创建
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </Link>
              <a className="landing-button landing-button--outline" href="#workflow">
                查看工作流
              </a>
            </div>
          </div>

          <GoddessVisual />
        </section>

        <section className="landing-section landing-product" id="product" aria-labelledby="product-title">
          <div className="landing-section__heading landing-section__heading--wide">
            <p className="landing-section__kicker">在最终画面之前</p>
            <h2 id="product-title">先做判断，再做图。</h2>
            <p>
              设计项目真正消耗时间的地方，通常不是最后一张图，而是需求、证据和取舍散落在不同工具里之后，没人知道下一步该相信什么。
            </p>
          </div>

          <div className="landing-product__list" role="list" aria-label="Muse 的核心价值">
            <article role="listitem">
              <span>01</span>
              <div>
                <h3>把问题变成简报</h3>
                <p>AI 先理解输入，设计师确认目标用户、场景、交付物和边界。</p>
              </div>
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </article>
            <article role="listitem">
              <span>02</span>
              <div>
                <h3>让证据进入方向</h3>
                <p>研究来源、视觉参考和设计洞察被保留下来，成为方向比较的依据。</p>
              </div>
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </article>
            <article role="listitem">
              <span>03</span>
              <div>
                <h3>把决定留在项目里</h3>
                <p>用户可以保留、排除、修改或创建新版本，下一步不会丢掉上一轮判断。</p>
              </div>
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            </article>
          </div>
        </section>

        <WorkflowSection />

        <section className="landing-section landing-philosophy" id="about" aria-labelledby="philosophy-title">
          <div className="landing-philosophy__statement">
            <p className="landing-section__kicker">人工参与决策</p>
            <h2 id="philosophy-title">AI 辅助探索，<br />人完成设计决策。</h2>
            <p>
              Muse 不是替代设计师的自动驾驶。它把重复的整理、比较和解释交给 AI，把真正影响结果的选择留给人。
            </p>
          </div>

          <div className="landing-ai-flow" aria-label="Muse 的 AI 工作边界">
            {aiFlow.map(([label, title, description], index) => (
              <div className={`landing-ai-flow__row${index === aiFlow.length - 1 ? " is-human" : ""}`} key={label}>
                <span>{label}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-example" id="examples" aria-labelledby="example-title">
          <div className="landing-section__heading">
            <p className="landing-section__kicker">项目案例</p>
            <h2 id="example-title">从一条模糊需求，到一个可以讨论的方向。</h2>
            <p>
              以“静境空气灯塔”为例。Muse 让项目从用户场景和设计问题开始，再把洞察推进到可以比较的产品方向。
            </p>
          </div>

          <div className="landing-example__grid">
            <figure>
              <picture>
                <source srcSet="/portfolio/muse/screens/02-brief.webp" type="image/webp" />
                <img
                  src="/portfolio/muse/screens/02-brief.png"
                  alt="静境空气灯塔项目的设计简报页面"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <figcaption>
                <span>之前</span>
                <strong>模糊需求被整理成一份可以确认的设计简报。</strong>
              </figcaption>
            </figure>
            <figure>
              <picture>
                <source srcSet="/portfolio/muse/screens/05-direction.webp" type="image/webp" />
                <img
                  src="/portfolio/muse/screens/05-direction.png"
                  alt="静境空气灯塔项目的创意方向页面"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <figcaption>
                <span>之后</span>
                <strong>洞察变成可比较的方向，并保留每个选择的理由。</strong>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section landing-changelog" id="changelog" aria-labelledby="changelog-title">
          <div className="landing-section__heading">
            <p className="landing-section__kicker">工作方式变化</p>
            <h2 id="changelog-title">让创意工作少一点丢失，多一点连续。</h2>
          </div>
          <div className="landing-changelog__list">
            {changeLog.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final" id="pricing" aria-labelledby="final-title">
          <div>
            <p className="landing-section__kicker">从一个真实项目开始</p>
            <h2 id="final-title">把下一次设计判断，带进 Muse。</h2>
            <p>
              Muse 当前以本地优先的工作台开始，不用先搭一套复杂系统。先把问题说清楚，再决定下一步。
            </p>
          </div>
          <Link className="landing-button landing-button--light" to="/projects/new">
            开始创建
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </Link>
        </section>

        <footer className="landing-footer">
          <div className="landing-footer__brand">
            <img src="/assets/brand/wordmark.svg" alt="Muse" />
            <p>AI 驱动的创意决策工作台</p>
          </div>
          <div className="landing-footer__links">
            <a href="#product">产品</a>
            <a href="#workflow">工作流</a>
            <a href="#examples">案例</a>
            <Link to="/projects">打开工作台</Link>
          </div>
          <p className="landing-footer__note">© 2026 Muse。帮助设计师做出更清晰的决定。</p>
        </footer>
      </div>
    </main>
  );
}

export { LandingPage };
