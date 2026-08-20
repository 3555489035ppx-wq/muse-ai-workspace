import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import GridLayout from "react-grid-layout/legacy";
import { RowsPhotoAlbum } from "react-photo-album";
import "react-grid-layout/css/styles.css";
import "react-photo-album/rows.css";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Copy,
  FilePlus2,
  FolderInput,
  GripVertical,
  Heart,
  ImagePlus,
  LayoutTemplate,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  SearchInput,
  StatusPill,
  TagList,
} from "../../components/ui";
import { templateCatalog } from "../../data/catalog";
import { createAssetRecords } from "../../lib/assets/museAssetPipeline";
import { templateLayouts } from "../../lib/layout/museGridAdapter";
import { searchRecords } from "../../lib/search/museSearch";
import { useMuseStore } from "../../stores/useMuseStore";

const ASSET_MISSING_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23131c20'/%3E%3Cpath d='M0 650h1200' stroke='%23364a4e' stroke-width='2'/%3E%3Ccircle cx='600' cy='350' r='82' fill='none' stroke='%23647b80' stroke-width='3'/%3E%3Cpath d='M520 350h160M600 270v160' stroke='%23647b80' stroke-width='3'/%3E%3C/svg%3E";

function displayAssetUrl(asset) {
  return typeof asset?.displayAsset === "string"
    ? asset.displayAsset
    : asset?.displayAsset?.url || asset?.originalAsset?.url || asset?.url || "";
}

function handleLibraryImageError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;
  image.dataset.fallbackApplied = "true";
  image.removeAttribute("srcset");
  image.src = ASSET_MISSING_PLACEHOLDER;
  image.classList.add("is-missing-asset");
}

function LibraryHeading({ eyebrow, title, description, action }) {
  return (
    <header className="library-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </header>
  );
}

function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(980);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () =>
      setWidth(Math.max(320, node.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function LegacyTemplatesPage() {
  const navigate = useNavigate();
  const customTemplates = useMuseStore((state) => state.templates);
  const favorites = useMuseStore((state) => state.templateFavorites);
  const toggleFavorite = useMuseStore((state) => state.toggleTemplateFavorite);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [gridRef, gridWidth] = useContainerWidth();
  const records = [...templateCatalog, ...customTemplates];
  const favoriteIds = new Set(favorites.map((item) => item.templateId));
  const categories = ["全部", ...new Set(records.map((item) => item.category))];
  const searched = searchRecords(records, query, [
    "name",
    "description",
    "category",
  ]);
  const visible = searched.filter(
    (item) =>
      (category === "全部" || item.category === category) &&
      (!onlyFavorites || favoriteIds.has(item.id)),
  );
  const layout = templateLayouts(visible, 12);
  return (
    <AppShell>
      <div className="library-page">
        <LibraryHeading
          eyebrow="通用起点"
          title="模板中心"
          description="模板只预填通用结构，项目名称、需求和受众仍由你填写。"
          action={
            <Button icon={Plus} onClick={() => navigate("/projects/new")}>
              新建空白项目
            </Button>
          }
        />
        <div className="library-toolbar">
          <SearchInput
            label="搜索模板"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模板"
            resultCount={searched.length}
          />
          <div className="filter-tabs liquid-glass-control">
            {categories.map((item) => (
              <button
                className={category === item ? "is-active" : ""}
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className={`favorite-filter ${onlyFavorites ? "is-active" : ""}`}
            onClick={() => setOnlyFavorites((value) => !value)}
          >
            <Heart size={15} fill={onlyFavorites ? "currentColor" : "none"} />
            只看收藏
          </button>
        </div>
        <div ref={gridRef} className="template-layout">
          {visible.length ? (
            <GridLayout
              width={gridWidth}
              layout={layout}
              cols={12}
              rowHeight={43}
              margin={[12, 12]}
              isResizable={false}
              draggableHandle=".template-card__handle"
              onLayoutChange={() => {}}
            >
              {visible.map((template) => (
                <article className="template-card" key={template.id}>
                  <div className="template-card__handle">
                    <GripVertical size={15} />
                    <span>{template.category}</span>
                  </div>
                  <div className="template-card__cover" style={{ "--template-accent": template.accent ?? "#375588" }}>
                    <img src={template.cover || "/assets/brand/muse-goddess-hero.webp"} alt="" />
                    <span>{template.category}</span>
                    <strong>{template.name}</strong>
                  </div>
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                  {template.bestFor ? <small>适合：{template.bestFor}</small> : null}
                  {template.defaults ? <div className="template-card__meta">
                    <span>{template.defaults.deliverables.slice(0, 2).join(" · ")}</span>
                    <span>{template.defaults.keywords.slice(0, 3).join(" / ")}</span>
                  </div> : null}
                  <div>
                    <IconButton
                      label={
                        favoriteIds.has(template.id) ? "取消收藏" : "收藏模板"
                      }
                      onClick={() => toggleFavorite(template.id)}
                    >
                      <Heart
                        size={16}
                        fill={
                          favoriteIds.has(template.id) ? "currentColor" : "none"
                        }
                      />
                    </IconButton>
                    <Button
                      icon={ArrowRight}
                      onClick={() =>
                        navigate(`/projects/new?template=${template.id}`)
                      }
                    >
                      使用模板
                    </Button>
                  </div>
                </article>
              ))}
            </GridLayout>
          ) : (
            <EmptyState
              title="没有匹配的模板"
              description="调整搜索或筛选条件后再试。"
              action={
                <Button
                  variant="quiet"
                  onClick={() => {
                    setQuery("");
                    setCategory("全部");
                    setOnlyFavorites(false);
                  }}
                >
                  清除筛选
                </Button>
              }
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

export { TemplatesPage } from "../templates/TemplatesPage";

function SortableTag({ tag, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: tag });
  const transformValue = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
    : undefined;
  return (
    <span
      ref={setNodeRef}
      className="asset-tag"
      style={{ transform: transformValue, transition }}
      {...attributes}
    >
      <button
        className="asset-tag__handle"
        {...listeners}
        aria-label={`拖动${tag}`}
      >
        <GripVertical size={12} />
      </button>
      {tag}
      <button onClick={() => onRemove(tag)} aria-label={`移除${tag}`}>
        <X size={12} />
      </button>
    </span>
  );
}

function AssetInspector({ asset, onClose, onClone }) {
  const updateAsset = useMuseStore((state) => state.updateAsset);
  const moveAssetToTrash = useMuseStore((state) => state.moveAssetToTrash);
  const [tagInput, setTagInput] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  if (!asset) return null;
  const tags = asset.tags ?? [];
  const colors = asset.colors ?? ["#171C1B", "#8A8F8A", "#DDD8CE"];
  const preview = displayAssetUrl(asset) || ASSET_MISSING_PLACEHOLDER;
  const saveTags = (nextTags) => updateAsset(asset.id, { tags: nextTags });
  return (
    <aside className="asset-inspector">
      <header>
        <div>
          <span>素材详情</span>
          <strong>{asset.name}</strong>
        </div>
        <IconButton label="关闭详情" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      <img
        src={preview}
        alt={asset.name}
        onError={handleLibraryImageError}
      />
      <div className="asset-inspector__meta">
        <span>用途 <b>{asset.role || "参考素材"}</b></span>
        <span>
          来源 <b>{asset.source || "项目参考素材"}</b>
        </span>
        <span>
          尺寸{" "}
          <b>
            {asset.width || 1200} × {asset.height || 800}
          </b>
        </span>
        <span>许可 <b>{asset.license || "仅限当前项目使用"}</b></span>
      </div>
      <section>
        <h3>主色调</h3>
        <div className="color-swatches">
          {colors.map((color) => (
            <i key={color} style={{ background: color }} title={color} />
          ))}
        </div>
      </section>
      <section>
        <h3>标签</h3>
        <DndContext
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const oldIndex = tags.indexOf(active.id);
            const newIndex = tags.indexOf(over.id);
            saveTags(arrayMove(tags, oldIndex, newIndex));
          }}
        >
          <SortableContext items={tags}>
            <div className="asset-tags">
              {tags.map((tag) => (
                <SortableTag
                  key={tag}
                  tag={tag}
                  onRemove={(value) =>
                    saveTags(tags.filter((item) => item !== value))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <form
          className="tag-entry"
          onSubmit={(event) => {
            event.preventDefault();
            const value = tagInput.trim();
            if (value && !tags.includes(value))
              saveTags([...tags, value]);
            setTagInput("");
          }}
        >
          <input
            aria-label="添加素材标签"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="输入标签"
          />
          <button type="submit">添加</button>
        </form>
      </section>
      <label className="favorite-row">
        <span>
          <Heart size={17} />
          收藏素材
        </span>
        <input
          type="checkbox"
          checked={Boolean(asset.favorite)}
          onChange={() => updateAsset(asset.id, { favorite: !asset.favorite })}
        />
      </label>
      <Button
        variant="danger"
        icon={Trash2}
        onClick={async () => {
          await moveAssetToTrash(asset.id);
          onClose();
        }}
      >
        移到回收站
      </Button>
      {asset.ownerScope === "starter" ? <Button variant="quiet" icon={Copy} onClick={() => onClone(asset.id)}>复制到我的素材库</Button> : null}
    </aside>
  );
}

export function AssetsPage() {
  const assets = useMuseStore((state) => state.assets);
  const account = useMuseStore((state) => state.account);
  const addGlobalAssets = useMuseStore((state) => state.addGlobalAssets);
  const cloneAssetToAccount = useMuseStore((state) => state.cloneAssetToAccount);
  const pushToast = useMuseStore((state) => state.pushToast);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const getAssetCategory = (asset) => {
    if (asset.role === "final") return "final";
    if (asset.role === "cmf") return "cmf";
    if (asset.role === "concept") return "concept";
    if (asset.role === "direction") return "generated";
    if (["scenario", "structure", "evidence"].includes(asset.role)) return "research";
    return asset.projectId ? "reference" : "uploaded";
  };
  const scopedAssets = assets.filter((asset) => filter === "mine"
    ? asset.ownerId === account?.id && asset.ownerScope !== "starter"
    : filter === "starter"
      ? asset.ownerScope === "starter"
      : true);
  const filtered = searchRecords(scopedAssets, query, [
    "name",
    "tags",
    "source",
  ]).filter((asset) =>
    filter === "mine" || filter === "starter"
      ? true
      : filter === "favorites"
      ? asset.favorite
      : filter === "all" ? true : getAssetCategory(asset) === filter,
  );
  const visible = filtered.filter((asset, index, records) => {
    const source = displayAssetUrl(asset);
    if (!source) return false;
    return records.findIndex((candidate) => displayAssetUrl(candidate) === source) === index;
  });
  const photos = visible.map((asset) => ({
    ...asset,
    src: displayAssetUrl(asset),
    width: asset.displayAsset?.width || asset.width || 1200,
    height: asset.displayAsset?.height || asset.height || 800,
    alt: asset.name,
  }));
  const selected = assets.find((asset) => asset.id === selectedId);
  const upload = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      await addGlobalAssets(await createAssetRecords(files));
    } catch (error) {
      pushToast(
        error.message === "IMAGE_DECODE_FAILED"
          ? "有图片无法读取，请更换文件"
          : "素材上传失败，请检查格式与大小",
        "error",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <AppShell>
      <div
        className={`library-page ${selected ? "library-page--inspector" : ""}`}
      >
        <LibraryHeading
          eyebrow="产品设计资产管理"
          title="素材库"
          description="按研究、参考、概念、CMF 与最终方案管理资产；每张图都应有明确来源与后续用途。"
          action={
            <label
              className={`button button--default ${uploading ? "is-loading" : ""}`}
            >
              <Upload size={16} />
              <span>{uploading ? "正在处理图片" : "上传素材"}</span>
              <input
                className="visually-hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={upload}
                disabled={uploading}
              />
            </label>
          }
        />
        <div className="library-toolbar">
          <SearchInput
            label="搜索素材"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、标签或来源"
            resultCount={visible.length}
          />
          <div className="filter-tabs">
            {[
              ["all", "全部"],
              ["mine", "我的素材"],
              ["starter", "起始素材"],
              ["uploaded", "已上传"],
              ["research", "研究证据"],
              ["reference", "参考素材"],
              ["generated", "AI 生成"],
              ["concept", "产品概念"],
              ["cmf", "材料与色彩"],
              ["final", "最终方案"],
              ["favorites", "我的收藏"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {photos.length ? (
          <div className="asset-album">
            <RowsPhotoAlbum
              photos={photos}
              targetRowHeight={210}
              spacing={10}
              componentsProps={{
                image: { onError: handleLibraryImageError },
              }}
              onClick={({ photo }) => setSelectedId(photo.id)}
            />
          </div>
        ) : (
          <EmptyState
            title="素材库还是空的"
            description="上传研究、参考、概念或 CMF 图片。Muse 会记录它们的来源、标签和项目关联。"
            action={
              <label className="button button--default">
                <ImagePlus size={16} />
                上传图片
                <input
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={upload}
                />
              </label>
            }
          />
        )}
      </div>
      <AssetInspector asset={selected} onClose={() => setSelectedId(null)} onClone={(assetId) => void cloneAssetToAccount(assetId)} />
    </AppShell>
  );
}

function ReuseDialog({ direction, onClose }) {
  const projects = useMuseStore((state) => state.projects);
  const reuseDirection = useMuseStore((state) => state.reuseDirection);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  if (!direction) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h2>复用到项目</h2>
        <p>
          将“{direction.name}”复制为目标项目中的新方向，不会修改方向库原记录。
        </p>
        <Field label="选择项目">
          {(id) => (
            <select
              id={id}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="dialog__actions">
          <Button variant="quiet" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!projectId}
            icon={FolderInput}
            onClick={async () => {
              await reuseDirection(direction.id, projectId);
              onClose();
            }}
          >
            确认复用
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LegacyDirectionLibraryPage() {
  const records = useMuseStore((state) => state.directionLibrary);
  const toggleFavorite = useMuseStore((state) => state.toggleDirectionFavorite);
  const toggleArchived = useMuseStore((state) => state.toggleDirectionArchived);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [reuse, setReuse] = useState(null);
  const visible = searchRecords(records, query, [
    "name",
    "summary",
    "tags",
    "sourceProjectName",
  ]).filter((item) =>
    filter === "favorite"
      ? item.favorite
      : filter === "archived"
        ? item.archived
        : !item.archived,
  );
  return (
    <AppShell>
      <div className="library-page">
        <LibraryHeading
          eyebrow="跨项目资源"
          title="方向库"
          description="收藏、归档并复用经过人工选择的创意方向。"
        />
        <div className="library-toolbar">
          <SearchInput
            label="搜索方向"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索方向、标签或来源项目"
            resultCount={visible.length}
          />
          <div className="filter-tabs">
            {[
              ["active", "可复用"],
              ["favorite", "我的收藏"],
              ["archived", "已归档"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {visible.length ? (
          <div className="direction-library-grid">
            {visible.map((item) => (
              <article key={item.id}>
                <div
                  className="direction-library-card__cover"
                  style={{ background: item.palette?.[0] ?? "#25332d" }}
                >
                  <Sparkles size={28} />
                </div>
                <div>
                  <StatusPill status="ai">
                    {item.sourceProjectName || "已保存方向"}
                  </StatusPill>
                  <h2>{item.name}</h2>
                  <p>{item.summary}</p>
                  <TagList items={item.tags} />
                  <footer>
                    <IconButton
                      label={item.favorite ? "取消收藏" : "收藏方向"}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      <Heart
                        size={16}
                        fill={item.favorite ? "currentColor" : "none"}
                      />
                    </IconButton>
                    <IconButton
                      label={item.archived ? "取消归档" : "归档方向"}
                      onClick={() => toggleArchived(item.id)}
                    >
                      {item.archived ? (
                        <ArchiveRestore size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </IconButton>
                    <Button icon={FolderInput} onClick={() => setReuse(item)}>
                      复用到项目
                    </Button>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={records.length ? "没有匹配的方向" : "还没有保存的创意方向"}
            description={
              records.length
                ? "调整搜索或筛选条件后再试。"
                : "在项目的创意方向页面完成比较并主动保存后，方向会出现在这里。"
            }
            action={
              records.length ? (
                <Button
                  variant="quiet"
                  onClick={() => {
                    setQuery("");
                    setFilter("active");
                  }}
                >
                  清除筛选
                </Button>
              ) : null
            }
          />
        )}
      </div>
      <ReuseDialog direction={reuse} onClose={() => setReuse(null)} />
    </AppShell>
  );
}

export { DirectionLibraryPage } from "./DirectionLibraryPage";
