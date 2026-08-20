import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TemplateCatalogRepository, type ProjectTemplateDefinition } from "../../application/template/index.js";
import { AppShell } from "../../components/shell.jsx";
import { Button, CustomSelect, EmptyState, SearchInput, StatusPill, TagList } from "../../components/ui.jsx";
import { ArrowRight, Heart, Plus } from "lucide-react";

export interface TemplatesPageProps {
  readonly repository?: TemplateCatalogRepository;
}

type TemplateMeta = {
  readonly cover: string;
  readonly category: string;
};

const templateMetaByName: Readonly<Record<string, TemplateMeta>> = {
  "便携式产品概念": { cover: "/assets/templates/template-portable-product-v1.png", category: "产品概念" },
  "家居小电器设计": { cover: "/assets/templates/template-home-appliance-v1.png", category: "家居设备" },
  "母婴产品设计": { cover: "/assets/templates/template-maternal-care-v1.png", category: "场景与用户" },
  "智能硬件外观设计": { cover: "/assets/templates/template-smart-hardware-v1.png", category: "产品设备" },
  "出行与随身产品": { cover: "/assets/templates/template-travel-product-v1.png", category: "场景与用户" },
  "健康与照护产品": { cover: "/assets/templates/template-care-device-v1.png", category: "产品设备" },
  "CMF 材料与色彩研究": { cover: "/assets/templates/template-cmf-v1.png", category: "材料与色彩" },
  "工业设计作品集案例": { cover: "/assets/templates/template-case-study-v1.png", category: "作品集案例" },
  "空白产品设计项目": { cover: "/assets/templates/template-blank-brief-v1.png", category: "产品概念" },
};

const categories = ["产品概念", "家居设备", "场景与用户", "产品设备", "材料与色彩", "作品集案例"];

export function TemplatesPage({ repository }: TemplatesPageProps) {
  const navigate = useNavigate();
  const catalog = useMemo(() => repository ?? new TemplateCatalogRepository(), [repository]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set());
  const templates = catalog.list().filter((template) => {
    const textMatch = `${template.name}${template.briefPlaceholder}${template.researchStrategy.focus.join("")}`.includes(query.trim());
    const templateCategory = templateMetaByName[template.name]?.category;
    return textMatch && (category === "all" || templateCategory === category);
  });
  const toggleFavorite = (template: ProjectTemplateDefinition) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(template.id)) next.delete(template.id); else next.add(template.id);
      return next;
    });
  };
  return (
    <AppShell>
      <main className="templates-page" aria-labelledby="templates-title">
        <header className="library-heading">
          <div>
            <p>产品设计的结构化起点</p>
            <h1 id="templates-title">模板中心</h1>
            <span>选择模板会预填产品命题、研究重点和方向策略；最终设计决策仍由你确认。</span>
          </div>
          <Button icon={Plus} onClick={() => navigate("/projects/new")}>新建空白项目</Button>
        </header>
        <div className="templates-toolbar">
          <SearchInput label="搜索模板" value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="搜索项目类型、研究重点或交付物" resultCount={templates.length} />
          <CustomSelect label="按模板类型筛选" value={category} onChange={setCategory} options={[{ value: "all", label: "全部类型" }, ...categories.map((value) => ({ value, label: value }))]} />
        </div>
        {templates.length ? (
          <section className="template-strategy-grid" aria-live="polite" aria-label="模板列表">
            {templates.map((template) => {
              const meta = templateMetaByName[template.name];
              return (
                <article className="template-strategy-card" key={template.id}>
                  <div className="template-strategy-card__cover">
                    <img src={meta?.cover ?? "/assets/jinganbao/hero-final.png"} alt="" />
                    <StatusPill status="ai">{meta?.category ?? "产品设计"}</StatusPill>
                  </div>
                  <div className="template-strategy-card__body">
                    <div><h2>{template.name}</h2><button className="template-favorite" aria-label={favorites.has(template.id) ? `取消收藏 ${template.name}` : `收藏 ${template.name}`} aria-pressed={favorites.has(template.id)} onClick={() => toggleFavorite(template)}><Heart aria-hidden="true" size={18} fill={favorites.has(template.id) ? "currentColor" : "none"} /></button></div>
                    <p>{template.briefPlaceholder}</p>
                    <dl><dt>研究重点</dt><dd>{template.researchStrategy.focus.join(" · ")}</dd><dt>参考策略</dt><dd>{template.moodboardStrategy.territoryHints.join(" · ")}</dd></dl>
                    <TagList items={template.directionStrategy.emphasis} />
                    <Link className="button button--default" to={`/projects/new?template=${template.id}`}>使用模板<ArrowRight aria-hidden="true" size={16} /></Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <EmptyState title="没有匹配的模板" description="调整搜索或模板类型后再试。" action={<Button variant="quiet" onClick={() => { setQuery(""); setCategory("all"); }}>清除筛选</Button>} />
        )}
      </main>
    </AppShell>
  );
}
