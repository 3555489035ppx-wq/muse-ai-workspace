import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArchiveRestore,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Database,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Palette,
  Plug,
  RefreshCw,
  Settings as SettingsIcon,
  Trash2,
  UserRound,
  Upload,
} from "lucide-react";
import { AppShell } from "../../components/shell";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  StatusPill,
  Surface,
} from "../../components/ui";
import {
  createMuseBundle,
  downloadJson,
  importMuseBundle,
  validateMuseBundle,
} from "../../lib/transfer/museBundle";
import { formatDate } from "../../lib/ids";
import { MuseAiClient } from "../../lib/api/museAiClient";
import { useMuseStore } from "../../stores/useMuseStore";
import { TOUR_STORAGE_KEY } from "../onboarding/tourConfig";

const aiClient = new MuseAiClient();

const providerOptions = [
  { value: "deepseek", label: "DeepSeek", text: "结构化文本推理" },
  { value: "openai", label: "OpenAI", text: "文本与图像能力" },
  { value: "gemini", label: "Google Gemini", text: "预留视觉与文本扩展" },
  { value: "anthropic", label: "Anthropic", text: "预留文本推理扩展" },
  { value: "custom", label: "Custom / OpenAI Compatible", text: "兼容 OpenAI 接口的服务" },
  { value: "demo-visual", label: "Demo Visual", text: "当前项目的演示视觉资产" },
];

function providerDraft(view) {
  return {
    provider: view?.provider ?? "deepseek",
    displayName: view?.displayName ?? "",
    baseUrl: view?.baseUrl ?? "",
    modelId: view?.modelId ?? view?.model ?? "",
    customModelId: view?.customModelId ?? "",
    enabled: view?.enabled ?? true,
    reasoningMode: view?.reasoningMode ?? "max",
    quality: view?.quality ?? "standard",
    aspectRatio: view?.aspectRatio ?? "square",
    apiKey: "",
  };
}

function providerStatusLabel(view) {
  if (!view || view.connectionStatus === "unconfigured") return "未配置";
  if (view.connectionStatus === "saved") return "已保存 · 待验证";
  if (view.connectionStatus === "connected") return "已连接";
  if (view.connectionStatus === "testing") return "验证中";
  return "连接失败";
}

function providerStatusTone(view) {
  if (view?.connectionStatus === "connected") return "success";
  if (view?.connectionStatus === "error") return "warn";
  return "warn";
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const preferences = useMuseStore((state) => state.preferences);
  const savePreference = useMuseStore((state) => state.savePreference);
  const clearAllLocalData = useMuseStore((state) => state.clearAllLocalData);
  const refresh = useMuseStore((state) => state.refresh);
  const pushToast = useMuseStore((state) => state.pushToast);
  const [tab, setTab] = useState(() => searchParams.get("tab") === "provider" ? "provider" : "data");
  const [density, setDensity] = useState(
    preferences.find((item) => item.id === "ui-density")?.value ??
      "comfortable",
  );
  const [cloudCapabilities, setCloudCapabilities] = useState(null);
  const [cloudError, setCloudError] = useState("");
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerLoadState, setProviderLoadState] = useState("initial");
  const [providerTests, setProviderTests] = useState({ text: { status: "idle" }, image: { status: "idle" } });
  const [providerData, setProviderData] = useState(null);
  const [providerDrafts, setProviderDrafts] = useState({ text: null, image: null });
  const [providerCategory, setProviderCategory] = useState("text");
  const [providerAdvanced, setProviderAdvanced] = useState(false);
  const [providerKeyModal, setProviderKeyModal] = useState(null);
  const [providerKeyValue, setProviderKeyValue] = useState("");
  const [showProviderKey, setShowProviderKey] = useState(false);
  const [confirmProviderDelete, setConfirmProviderDelete] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [strategy, setStrategy] = useState("skip");
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    document.body.dataset.density = density;
  }, [density]);
  useEffect(() => {
    if (tab !== "provider") return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      setProviderLoading(false);
      setProviderLoadState("error");
      setCloudError((current) => current || "AI 服务暂时无法连接，你的项目数据没有丢失。请重新连接。");
    }, 5000);
    setProviderLoading(true);
    setProviderLoadState("checking_service");
    aiClient.health(controller.signal).then(() => {
      setProviderLoadState("loading_config");
      return Promise.all([aiClient.capabilities(controller.signal), aiClient.providerConfigs(controller.signal)]);
    }).then(([capabilities, providers]) => {
      setCloudCapabilities(capabilities);
      setProviderData(providers);
      setProviderDrafts({ text: providerDraft(providers.providers.text), image: providerDraft(providers.providers.image) });
      setCloudError("");
      setProviderLoadState("ready");
    }).catch((error) => {
      if (error?.name === "AbortError") return;
      setProviderLoadState("error");
      setCloudError(error?.message || "AI 服务暂时无法连接，你的项目数据没有丢失。请重新连接。");
    }).finally(() => {
      window.clearTimeout(timeoutId);
      setProviderLoading(false);
    });
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [tab]);
  const exportAll = async () =>
    downloadJson(
      await createMuseBundle(),
      `Muse-工作区备份-${new Date().toISOString().slice(0, 10)}.json`,
    );
  const readImport = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const input = JSON.parse(await file.text());
      const result = validateMuseBundle(input);
      if (!result.ok) throw new Error(result.issues.join("；"));
      setImportPreview(result.bundle);
    } catch (error) {
      pushToast(`导入文件无效：${error.message}`, "error");
    }
  };
  const executeImport = async () => {
    const result = await importMuseBundle(importPreview, strategy);
    await refresh();
    setImportPreview(null);
    pushToast(
      `导入完成：新增 ${result.imported} 条，跳过 ${result.skipped} 条`,
    );
  };
  const reloadProviderState = async () => {
    setProviderLoadState("checking_service");
    await aiClient.health();
    setProviderLoadState("loading_config");
    const [capabilities, providers] = await Promise.all([aiClient.capabilities(), aiClient.providerConfigs()]);
    setCloudCapabilities(capabilities);
    setProviderData(providers);
    setProviderDrafts({ text: providerDraft(providers.providers.text), image: providerDraft(providers.providers.image) });
    setCloudError("");
    setProviderLoadState("ready");
  };
  const updateProviderDraft = (key, value) => {
    setProviderDrafts((current) => {
      const nextDraft = { ...current[providerCategory], [key]: value };
      if (key === "apiKey" && typeof value === "string" && value.trim() && !nextDraft.enabled) nextDraft.enabled = true;
      return { ...current, [providerCategory]: nextDraft };
    });
  };
  const saveCurrentProvider = async () => {
    const draft = providerDrafts[providerCategory];
    if (!draft) return;
    setProviderTests((value) => ({ ...value, [providerCategory]: { status: "saving" } }));
    try {
      await aiClient.saveProviderConfig(providerCategory, { ...draft, apiKey: draft.apiKey || undefined });
      await reloadProviderState();
      setProviderTests((value) => ({ ...value, [providerCategory]: { status: "saved" } }));
      pushToast(`${providerCategory === "text" ? "Text AI" : "Image AI"} 配置已保存`);
    } catch (error) {
      setProviderTests((value) => ({ ...value, [providerCategory]: { status: "failed", message: error?.message || "保存失败" } }));
    }
  };
  const testCurrentProvider = async () => {
    const draft = providerDrafts[providerCategory];
    if (!draft) return;
    setProviderTests((value) => ({ ...value, [providerCategory]: { status: "testing" } }));
    try {
      const result = await aiClient.testProviderConfig(providerCategory, { ...draft, apiKey: draft.apiKey || undefined }, true);
      await reloadProviderState();
      setProviderTests((value) => ({ ...value, [providerCategory]: { status: "success", ...result } }));
    } catch (error) {
      setProviderTests((value) => ({ ...value, [providerCategory]: { status: "failed", message: error?.message || "连接失败" } }));
    }
  };
  const deleteCurrentProvider = async () => {
    try {
      await aiClient.deleteProviderConfig(providerCategory);
      await reloadProviderState();
      setProviderTests((value) => ({ ...value, [providerCategory]: { status: "idle" } }));
      setConfirmProviderDelete(null);
      pushToast("Provider 配置已删除");
    } catch (error) {
      pushToast(error?.message || "删除失败", "error");
    }
  };
  const activeProvider = providerData?.providers?.[providerCategory];
  const activeDraft = providerDrafts[providerCategory];
  const activeTest = providerTests[providerCategory];
  const openProviderKeyModal = () => {
    setProviderKeyValue("");
    setShowProviderKey(false);
    setProviderKeyModal(providerCategory);
  };
  const commitProviderKey = () => {
    if (!providerKeyValue.trim()) return;
    updateProviderDraft("apiKey", providerKeyValue.trim());
    setProviderKeyModal(null);
    setProviderKeyValue("");
  };
  const restartOnboarding = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    location.assign("/projects?tour=restart");
  };
  return (
    <AppShell>
      <div className="settings-page" data-provider-state={tab === "provider" ? providerLoadState : undefined}>
        <header className="page-heading">
          <p>全局设置</p>
          <h1>设置</h1>
          <span>管理界面偏好、数据备份，以及 DeepSeek Text AI 与 OpenAI Image AI 的真实服务状态。</span>
        </header>
        <div className="settings-layout">
          <nav>
            {[
              ["data", Database, "本地数据"],
              ["appearance", Palette, "界面偏好"],
              ["provider", Plug, "AI 服务 / API"],
            ].map(([value, Icon, label]) => (
              <button
                key={value}
                data-tour={value === "provider" ? "provider" : undefined}
                className={tab === value ? "is-active" : ""}
                onClick={() => setTab(value)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {tab === "data" ? (
              <>
                <Surface title="数据保存位置">
                  <div className="setting-copy">
                    <HardDrive size={22} />
                    <div>
                      <strong>当前浏览器本地保存</strong>
                      <p>
                        项目、研究、素材、方向与版本均保存在这台设备的当前浏览器中；清除浏览器站点数据可能导致内容丢失。
                      </p>
                    </div>
                  </div>
                </Surface>
                <Surface title="导出工作区">
                  <p>
                    下载包含主要项目数据的 Muse JSON 备份，可用于迁移或恢复。
                  </p>
                  <Button icon={Download} onClick={exportAll}>
                    导出全部数据
                  </Button>
                </Surface>
                <Surface title="导入工作区">
                  <p>
                    导入前会检查文件格式。遇到同 ID 数据时，可跳过现有项或覆盖。
                  </p>
                  <label className="button button--quiet">
                    <Upload size={16} />
                    选择 Muse JSON
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="application/json,.json"
                      onChange={readImport}
                    />
                  </label>
                </Surface>
                <Surface title="清空本地数据" className="danger-zone">
                  <div className="setting-copy">
                    <Trash2 size={22} />
                    <div>
                      <strong>删除当前浏览器中的全部 Muse 数据</strong>
                      <p>
                        将永久删除项目、素材、个人模板、方向、评审与版本记录。此操作无法撤销，建议先导出备份。
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setConfirmClear(true)}
                  >
                    清空全部本地数据
                  </Button>
                </Surface>
              </>
            ) : null}
            {tab === "appearance" ? (
              <>
                <Surface title="信息密度">
                  <div className="setting-options">
                    {[
                      ["comfortable", "舒适"],
                      ["compact", "紧凑"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className={density === value ? "is-selected" : ""}
                      >
                        <input
                          type="radio"
                          name="density"
                          checked={density === value}
                          onChange={async () => {
                            setDensity(value);
                            await savePreference("ui-density", value);
                          }}
                        />
                        <span>
                          <b>{label}</b>
                          <small>
                            {value === "compact"
                              ? "同屏展示更多信息"
                              : "保留更充足的阅读间距"}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </Surface>
                <Surface title="界面主题">
                  <div className="setting-copy">
                    <Palette size={22} />
                    <div>
                      <strong>深色工作台</strong>
                      <p>
                        当前版本使用与参考界面一致的深色视觉系统，保证画布与视觉素材对比清晰。
                      </p>
                    </div>
                  </div>
                </Surface>
                <Surface title="新手引导">
                  <p>新手引导默认只在首次进入时显示一次，不会在切换页面或刷新后再次打断工作。</p>
                  <Button variant="quiet" onClick={restartOnboarding}>重新查看新手引导</Button>
                </Surface>
              </>
            ) : null}
            {tab === "provider" ? (
              <>
                <Surface title="真实 AI 运行状态" className="provider-overview">
                  <div className="provider-status-head">
                    <div className="provider-status-mark"><Cloud size={22} /></div>
                    <div>
                      <strong>{cloudCapabilities?.mode === "real" ? "文本与图片服务均已就绪" : cloudCapabilities?.mode === "partial" ? "部分真实 AI 已就绪" : "先连接 Provider，再开始真实生成"}</strong>
                      <p>Text AI 与 Image AI 独立配置。没有连接的能力会明确显示不可用，不会把离线结果标记为实时生成。</p>
                    </div>
                    <StatusPill status={cloudCapabilities?.mode === "real" ? "success" : cloudCapabilities?.mode === "partial" ? "ai" : "warn"}>{cloudCapabilities?.mode === "real" ? "REAL" : cloudCapabilities?.mode === "partial" ? "PARTIAL" : "未就绪"}</StatusPill>
                  </div>
                  {cloudError ? <div className="provider-inline-error"><AlertCircle size={16}/>{cloudError}</div> : null}
                  <div className="provider-capability-summary">
                    {[
                      ["text", "Text AI", cloudCapabilities?.providers?.text, "项目理解、研究压缩、方向与评审"],
                      ["image", "Image AI", cloudCapabilities?.providers?.image, "概念视觉、CMF 变体与受控编辑"],
                    ].map(([kind, title, provider, purpose]) => <button type="button" key={kind} className={`provider-capability-card ${providerCategory === kind ? "is-active" : ""}`} onClick={() => setProviderCategory(kind)}>
                      <span className="provider-capability-card__top"><span>{title}</span><StatusPill status={provider?.ready ? "success" : "warn"}>{provider?.ready ? "可用" : "待连接"}</StatusPill></span>
                      <strong>{provider?.label ?? "尚未选择 Provider"}</strong>
                      <small>{purpose}</small>
                    </button>)}
                  </div>
                </Surface>
                {activeDraft ? <Surface title={`${providerCategory === "text" ? "Text AI" : "Image AI"} Provider 配置`} className="provider-config-surface" action={<StatusPill status={providerStatusTone(activeProvider)}>{providerStatusLabel(activeProvider)}</StatusPill>}>
                  <div className="provider-config-intro">
                    <div><strong>{activeProvider?.displayName || "配置你的 AI 服务"}</strong><p>{providerCategory === "text" ? "用于把项目输入整理成可追溯的简报、研究判断、方向与评审。" : "用于生成产品概念图、材料变体与受控的视觉编辑。"}</p></div>
                    <span className="provider-config-capabilities">{(activeProvider?.capabilities ?? []).join(" · ")}</span>
                  </div>
                  <div className="provider-form-grid">
                    <Field label="AI Provider" hint="可切换，Custom 用于 OpenAI-compatible API"><select value={activeDraft.provider} onChange={(event) => updateProviderDraft("provider", event.target.value)}>{providerOptions.map((option) => <option value={option.value} key={option.value}>{option.label} · {option.text}</option>)}</select></Field>
                    <Field label="模型 ID" hint="可直接填写服务商提供的模型名称"><input value={activeDraft.modelId} onChange={(event) => updateProviderDraft("modelId", event.target.value)} placeholder={providerCategory === "text" ? "deepseek-v4-pro" : "gpt-image-2"}/></Field>
                    <Field label="API Base URL" hint="仅允许 HTTPS，或本机 localhost / 127.0.0.1"><input value={activeDraft.baseUrl} onChange={(event) => updateProviderDraft("baseUrl", event.target.value)} placeholder="https://api.example.com/v1" spellCheck="false"/></Field>
                    <div className="provider-secret-field"><span className="field__label">API Key</span><span className="field__hint">完整密钥只发送给 Muse 安全 API，不写入浏览器持久化数据。</span><div className="provider-secret-control"><code>{activeProvider?.keyHint ?? "尚未添加密钥"}</code><Button variant="quiet" icon={KeyRound} onClick={openProviderKeyModal}>{activeProvider?.keyHint ? "更换密钥" : "添加密钥"}</Button></div></div>
                  </div>
                  {providerCategory === "text" ? <Field label="推理模式" hint="DeepSeek 支持 high / max；其他兼容服务会按接口能力处理"><select value={activeDraft.reasoningMode} onChange={(event) => updateProviderDraft("reasoningMode", event.target.value)}><option value="standard">标准</option><option value="high">高</option><option value="max">最大</option></select></Field> : <div className="provider-form-grid"><Field label="默认质量"><select value={activeDraft.quality} onChange={(event) => updateProviderDraft("quality", event.target.value)}><option value="standard">标准</option><option value="high">高</option></select></Field><Field label="默认比例"><select value={activeDraft.aspectRatio} onChange={(event) => updateProviderDraft("aspectRatio", event.target.value)}><option value="square">方形</option><option value="landscape">横向</option><option value="portrait">竖向</option></select></Field></div>}
                  <button type="button" className="provider-advanced-toggle" onClick={() => setProviderAdvanced((value) => !value)}><span>高级设置</span><small>显示名称、自定义模型 ID 与运行开关</small><ChevronDown size={16} className={providerAdvanced ? "is-open" : ""}/></button>
                  {providerAdvanced ? <div className="provider-form-grid provider-form-grid--advanced"><Field label="显示名称"><input value={activeDraft.displayName} onChange={(event) => updateProviderDraft("displayName", event.target.value)} placeholder="例如：我的 Text AI"/></Field><Field label="Custom Model ID" hint="填写后优先使用此 ID"><input value={activeDraft.customModelId} onChange={(event) => updateProviderDraft("customModelId", event.target.value)} placeholder="可选"/></Field><label className="provider-enabled-toggle"><input type="checkbox" checked={activeDraft.enabled} onChange={(event) => updateProviderDraft("enabled", event.target.checked)}/><span><strong>允许 Muse 使用这个 Provider</strong><small>关闭后不会发起真实请求，也不会生成实时结果。</small></span></label></div> : null}
                  {activeTest.status === "failed" ? <div className="provider-inline-error"><AlertCircle size={15}/><span>{activeTest.message}</span></div> : null}
                  {activeTest.status === "success" ? <div className="provider-test-result"><CheckCircle2 size={16}/><span>真实连接成功 · {activeTest.model} · {activeTest.latencyMs} ms</span></div> : null}
                  <div className="provider-config-actions"><Button variant="quiet" icon={RefreshCw} loading={activeTest.status === "testing"} disabled={activeTest.status === "testing"} onClick={() => void testCurrentProvider()}>{activeTest.status === "testing" ? "正在真实调用…" : "测试真实连接"}</Button><Button icon={Check} loading={activeTest.status === "saving"} onClick={() => void saveCurrentProvider()}>保存配置</Button>{activeProvider?.keyHint ? <Button variant="danger" onClick={() => setConfirmProviderDelete(providerCategory)}>删除配置</Button> : null}</div>
                </Surface> : providerLoading ? <div className="provider-inline-loading" role="status"><RefreshCw size={16} className="is-spinning"/>正在连接 AI 服务…</div> : <div className="provider-inline-error provider-inline-error--standalone"><AlertCircle size={16}/><span>AI 服务暂时无法连接，你的项目数据没有丢失。</span><Button variant="quiet" icon={RefreshCw} onClick={() => { setProviderLoading(true); void reloadProviderState().catch((error) => { setProviderLoadState("error"); setCloudError(error?.message || "重新连接失败"); }).finally(() => setProviderLoading(false)); }}>重新连接</Button></div>}
                <Surface title="密钥与运行边界" className="provider-security-note">
                  <div className="provider-security-grid"><div><strong>{providerData?.storage === "encrypted-session-cookie" ? "线上加密会话" : "Local Secret Store"}</strong><p>{providerData?.storage === "encrypted-session-cookie" ? "上线后，Key 会保存在当前浏览器的 HttpOnly 加密会话中，只能由 Muse 服务端读取；不会进入 LocalStorage、项目 JSON、URL 或运行记录。" : "本地开发时，Key 保存在服务端的 <code>.muse-runtime</code> 加密文件中；浏览器只收到掩码后缀，不会写入 LocalStorage、项目 JSON、URL 或运行记录。"}</p></div><div><strong>真实失败会保留失败状态</strong><p>测试会真实访问 Provider；认证失败、余额不足、限流、Base URL 错误都会显示可操作的错误状态，Muse 不会自动切换成实时结果。</p></div></div>
                </Surface>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {importPreview ? (
        <div className="dialog-backdrop">
          <div className="dialog import-dialog">
            <h2>确认导入数据？</h2>
            <p>
              文件包含{" "}
              {Object.values(importPreview.data).reduce(
                (sum, records) => sum + records.length,
                0,
              )}{" "}
              条记录。请选择冲突处理方式。
            </p>
            <div className="import-strategy">
              <label>
                <input
                  type="radio"
                  checked={strategy === "skip"}
                  onChange={() => setStrategy("skip")}
                />
                保留现有数据并跳过冲突
              </label>
              <label>
                <input
                  type="radio"
                  checked={strategy === "overwrite"}
                  onChange={() => setStrategy("overwrite")}
                />
                用导入文件覆盖同 ID 数据
              </label>
            </div>
            <div className="dialog__actions">
              <Button variant="quiet" onClick={() => setImportPreview(null)}>
                取消
              </Button>
              <Button onClick={executeImport}>开始导入</Button>
            </div>
          </div>
        </div>
      ) : null}
      {providerKeyModal ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProviderKeyModal(null); }}>
        <div className="dialog provider-key-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-key-title">
          <div className="provider-key-dialog__head"><div><p className="industrial-kicker">{providerKeyModal === "text" ? "TEXT AI" : "IMAGE AI"}</p><h2 id="provider-key-title">{activeProvider?.keyHint ? "更换 API Key" : "添加 API Key"}</h2></div><button type="button" className="icon-button" aria-label="关闭密钥窗口" onClick={() => setProviderKeyModal(null)}>×</button></div>
          <p>完整密钥只在保存或测试时发送一次。Muse 不会在页面再次显示完整密钥，也不会写入 LocalStorage、项目 JSON 或导出文件。</p>
          <label className="provider-key-input"><span>API Key</span><div><input autoFocus type={showProviderKey ? "text" : "password"} value={providerKeyValue} onChange={(event) => setProviderKeyValue(event.target.value)} placeholder="粘贴你的 API Key" spellCheck="false" autoComplete="off"/><button type="button" aria-label={showProviderKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowProviderKey((value) => !value)}>{showProviderKey ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          <div className="dialog__actions"><Button variant="quiet" onClick={() => setProviderKeyModal(null)}>取消</Button><Button icon={KeyRound} disabled={!providerKeyValue.trim()} onClick={commitProviderKey}>仅保存在本次配置</Button></div>
        </div>
      </div> : null}
      <ConfirmDialog
        open={Boolean(confirmProviderDelete)}
        title="删除这个 Provider 配置？"
        description="Muse 会删除当前 Provider 的 API Key 配置。项目数据不会受影响，之后需要重新输入才能使用。"
        confirmText="确认删除"
        danger
        onCancel={() => setConfirmProviderDelete(null)}
        onConfirm={() => void deleteCurrentProvider()}
      />
      <ConfirmDialog
        open={confirmClear}
        title="永久清空全部本地数据？"
        description="项目、素材、个人模板、方向、评审与版本记录都会被永久删除，且无法从回收站恢复。"
        confirmText="确认永久清空"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearAllLocalData();
          setConfirmClear(false);
        }}
      />
    </AppShell>
  );
}

export function AccountPage() {
  const account = useMuseStore((state) => state.account);
  const saveLocalAccount = useMuseStore((state) => state.saveLocalAccount);
  const assets = useMuseStore((state) => state.assets);
  const projects = useMuseStore((state) => state.projects);
  const [displayName, setDisplayName] = useState(account?.displayName ?? "本地访客");
  const [email, setEmail] = useState(account?.email ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(account?.displayName ?? "本地访客");
    setEmail(account?.email ?? "");
  }, [account]);

  const submit = async (event) => {
    event.preventDefault();
    await saveLocalAccount({ displayName: displayName.trim() || "本地访客", email: email.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  const ownedAssets = assets.filter((item) => item.ownerId === account?.id && item.ownerScope !== "starter");
  const ownedProjects = projects.filter((item) => item.ownerId === account?.id);
  return (
    <AppShell>
      <div className="account-page settings-page">
        <header className="page-heading">
          <p>ACCOUNT / LOCAL WORKSPACE</p>
          <h1>账号与个人素材库</h1>
          <span>这是当前浏览器中的本地账号。它让项目、上传素材与起始素材副本有明确归属；接入生产鉴权后可平滑替换为云端账号。</span>
        </header>
        <div className="account-layout">
          <Surface title="我的账号">
            <div className="account-identity"><span className="account-identity__avatar"><UserRound size={22} /></span><div><strong>{account?.displayName || "本地访客"}</strong><small>{account?.email || "未填写邮箱"}</small></div></div>
            <form className="account-form" onSubmit={submit}>
              <Field label="显示名称" hint="用于侧边栏和项目归属显示"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：林一" /></Field>
              <Field label="邮箱（可选）" hint="当前只用于本地资料标识，不会发送验证邮件"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></Field>
              <div className="account-form__actions"><Button icon={Check} type="submit">{saved ? "已保存" : "保存账号信息"}</Button><StatusPill status="warn">本地模式</StatusPill></div>
            </form>
          </Surface>
          <Surface title="当前归属">
            <div className="account-stats"><div><strong>{ownedProjects.length}</strong><span>我的项目</span></div><div><strong>{ownedAssets.length}</strong><span>我的素材</span></div><div><strong>{assets.filter((item) => item.ownerScope === "starter").length}</strong><span>起始素材</span></div></div>
            <p>起始素材可以直接浏览，也可以在素材详情中复制到“我的素材库”；复制后你可以独立修改标签、颜色和用途，不会污染起始素材。</p>
          </Surface>
          <Surface title="账号边界">
            <ul className="account-boundary"><li>项目创建、上传图片和 AI 视觉候选会记录当前账号归属。</li><li>未接入 API 时仍可完整使用本地结构化结果，不会因为账号或 API 配置缺失而卡住。</li><li>要迁移到另一台设备，请先在设置中导出 Muse JSON；生产部署时再接入正式鉴权和数据库。</li></ul>
          </Surface>
        </div>
      </div>
    </AppShell>
  );
}

export function TrashPage() {
  const trash = useMuseStore((state) => state.trash);
  const restore = useMuseStore((state) => state.restoreTrashEntry);
  const deletePermanently = useMuseStore((state) => state.deleteTrashEntry);
  const [pendingDelete, setPendingDelete] = useState(null);
  const label = (entry) =>
    entry.entityType === "project"
      ? entry.snapshot.project?.name
      : entry.snapshot.name;
  return (
    <AppShell>
      <div className="trash-page">
        <header className="page-heading">
          <p>本地数据</p>
          <h1>回收站</h1>
          <span>恢复误删内容，或确认后永久删除。永久删除无法撤销。</span>
        </header>
        {trash.length ? (
          <div className="trash-list">
            {trash.map((entry) => (
              <article key={entry.id}>
                <div className="trash-icon">
                  <Trash2 size={19} />
                </div>
                <div>
                  <strong>{label(entry)}</strong>
                  <span>
                    {entry.entityType === "project" ? "项目" : "素材"} · 删除于{" "}
                    {formatDate(entry.deletedAt)}
                  </span>
                </div>
                <Button
                  variant="quiet"
                  icon={ArchiveRestore}
                  onClick={() => restore(entry.id)}
                >
                  恢复
                </Button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => setPendingDelete(entry)}
                >
                  永久删除
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="回收站是空的"
            description="已移除的项目与素材会保留在这里，直到你永久删除。"
          />
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="永久删除这条内容？"
        description="删除后无法恢复，关联的回收站快照也会一并移除。"
        confirmText="永久删除"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          await deletePermanently(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
