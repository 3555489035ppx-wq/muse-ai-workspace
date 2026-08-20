import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SafeApiError } from "../api/envelope.js";
import type { MuseServerConfig } from "../config.js";
import { SecretStore } from "./SecretStore.js";
import { providerNameSchema } from "../contracts/providers.js";
import type { ConnectionStatus, ProviderCategory, ProviderConfigInput, ProviderConfigView, ProviderName } from "../contracts/providers.js";

interface StoredProviderConfig {
  readonly id: string;
  readonly category: ProviderCategory;
  readonly provider: ProviderName;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly customModelId?: string;
  readonly enabled: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly capabilities: readonly string[];
  readonly secretConfigured: boolean;
  readonly updatedAt: string;
  readonly lastError?: string;
  readonly lastTestedAt?: string;
  readonly lastErrorCode?: string;
  readonly reasoningMode?: "off" | "standard" | "high" | "max";
  readonly quality?: "standard" | "high";
  readonly aspectRatio?: "square" | "landscape" | "portrait";
}

export interface ProviderRuntimeConfig extends StoredProviderConfig {
  readonly model: string;
  readonly apiKey?: string;
}

interface ProviderDefault {
  readonly displayName: string;
  readonly baseUrl: string;
  readonly modelId: string;
}

const DEFAULTS: Record<ProviderCategory, Partial<Record<ProviderName, ProviderDefault>>> = {
  text: {
    deepseek: { displayName: "DeepSeek Text AI", baseUrl: "https://api.deepseek.com", modelId: "deepseek-v4-pro" },
    openai: { displayName: "OpenAI Text AI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-5.2" },
    gemini: { displayName: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", modelId: "gemini-2.5-pro" },
    anthropic: { displayName: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", modelId: "claude-sonnet-4-20250514" },
    custom: { displayName: "自定义 Text AI", baseUrl: "", modelId: "" },
    "custom-openai-compatible": { displayName: "自定义 OpenAI Compatible", baseUrl: "", modelId: "" },
  },
  image: {
    openai: { displayName: "OpenAI Image AI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-image-2" },
    gemini: { displayName: "Google Image AI", baseUrl: "https://generativelanguage.googleapis.com/v1beta", modelId: "imagen-4" },
    anthropic: { displayName: "Anthropic Image", baseUrl: "", modelId: "" },
    custom: { displayName: "自定义 Image AI", baseUrl: "", modelId: "" },
    "custom-openai-compatible": { displayName: "自定义 OpenAI Compatible", baseUrl: "", modelId: "" },
    "demo-visual": { displayName: "Demo Visual", baseUrl: "", modelId: "demo-visual" },
  },
};

const CAPABILITIES: Record<ProviderCategory, readonly string[]> = {
  text: ["textGeneration", "structuredOutput", "reasoning"],
  image: ["imageGeneration", "imageEditing"],
};
const DEMO_CAPABILITIES = ["demoImageSelection", "demoVariationLookup"] as const;

function canonicalProvider(provider: ProviderName): ProviderName {
  return provider === "custom" ? "custom-openai-compatible" : provider;
}

function defaultFor(category: ProviderCategory, provider: ProviderName): ProviderDefault {
  const value = DEFAULTS[category][canonicalProvider(provider)];
  if (!value) throw new SafeApiError("INVALID_PROVIDER", "当前 Provider 不支持此类 AI 服务。", 400);
  return value;
}

function capabilitiesFor(category: ProviderCategory, provider: ProviderName): readonly string[] {
  return category === "image" && canonicalProvider(provider) === "demo-visual" ? DEMO_CAPABILITIES : CAPABILITIES[category];
}

function maskSecret(value?: string): string | undefined {
  if (!value) return undefined;
  const suffix = value.slice(-4);
  return `${value.startsWith("sk-") ? "sk-" : ""}••••••••${suffix}`;
}

function normalizeBaseUrl(raw: string): string {
  const value = raw.trim().replace(/\/$/, "");
  if (!value) return value;
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new SafeApiError("INVALID_PROVIDER_BASE_URL", "Base URL 格式无效。", 400); }
  const host = parsed.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new SafeApiError("UNSAFE_PROVIDER_BASE_URL", "Provider Base URL 只允许 HTTPS，或本机 localhost / 127.0.0.1。", 400);
  }
  if (parsed.username || parsed.password) throw new SafeApiError("UNSAFE_PROVIDER_BASE_URL", "Base URL 不能包含账号或密码。", 400);
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function resolvedModel(category: ProviderCategory, provider: ProviderName, modelId?: string, customModelId?: string): string {
  if (customModelId?.trim()) return customModelId.trim();
  const candidate = modelId?.trim();
  if (candidate) return candidate;
  return defaultFor(category, provider).modelId;
}

function secretName(category: ProviderCategory, provider: ProviderName): string {
  return `${category}:${canonicalProvider(provider)}`;
}

export class ProviderConfigStore {
  readonly #filePath: string;
  readonly #legacyFilePath: string;
  readonly #serverConfig: MuseServerConfig;
  readonly #secretStore: SecretStore;
  readonly #records = new Map<ProviderCategory, StoredProviderConfig>();

  constructor(serverConfig: MuseServerConfig) {
    this.#serverConfig = serverConfig;
    this.#filePath = resolve(process.cwd(), serverConfig.runtimeDirectory, "providers.json");
    this.#legacyFilePath = resolve(process.cwd(), serverConfig.runtimeDirectory, "provider-configs.json");
    this.#secretStore = new SecretStore(serverConfig);
    this.#loadSync();
  }

  get(category: ProviderCategory): ProviderRuntimeConfig {
    const record = this.#records.get(category) ?? this.#fromEnvironment(category);
    const apiKey = this.#secretStore.get(secretName(category, record.provider)) ?? this.#environmentSecret(category, record.provider);
    return { ...record, model: record.modelId, apiKey };
  }

  view(category: ProviderCategory): ProviderConfigView {
    const record = this.#records.get(category) ?? this.#fromEnvironment(category);
    const apiKey = this.#secretStore.get(secretName(category, record.provider)) ?? this.#environmentSecret(category, record.provider);
    return { ...record, model: record.modelId, secretConfigured: Boolean(apiKey), keyHint: maskSecret(apiKey) };
  }

  allViews(): { readonly text: ProviderConfigView; readonly image: ProviderConfigView } {
    return { text: this.view("text"), image: this.view("image") };
  }

  configuredViews(): readonly ProviderConfigView[] {
    return (["text", "image"] as const).map((category) => this.view(category)).filter((view) => view.secretConfigured || (view.category === "image" && view.provider === "demo-visual"));
  }

  async save(category: ProviderCategory, input: ProviderConfigInput, status: ConnectionStatus = "saved", lastError?: string): Promise<ProviderConfigView> {
    const current = this.get(category);
    const provider = canonicalProvider(input.provider);
    const defaults = defaultFor(category, provider);
    const targetSecret = secretName(category, provider);
    const oldSecret = secretName(category, current.provider);
    const apiKey = input.apiKey === undefined
      ? (provider === current.provider ? current.apiKey : this.#secretStore.get(targetSecret))
      : input.apiKey.trim();
    const isDemo = category === "image" && provider === "demo-visual";
    if (!isDemo && !apiKey) throw new SafeApiError("PROVIDER_KEY_REQUIRED", "请先输入 API Key，再保存 Provider。", 400);
    const baseUrl = normalizeBaseUrl(input.baseUrl ?? defaults.baseUrl);
    if (!isDemo && !baseUrl) throw new SafeApiError("PROVIDER_BASE_URL_REQUIRED", "请填写 Provider Base URL。", 400);
    // Legacy clients may still send `model`; keep the migration alias readable.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const modelId = resolvedModel(category, provider, input.modelId ?? input.model, input.customModelId);
    if (!isDemo && !modelId) throw new SafeApiError("PROVIDER_MODEL_REQUIRED", "请填写 Provider Model ID。", 400);
    const now = new Date().toISOString();
    const previous = this.#records.get(category);
    const trimmedDisplayName = input.displayName?.trim();
    const trimmedCustomModelId = input.customModelId?.trim();
    const record: StoredProviderConfig = {
      id: `${category}-provider`, category, provider,
      displayName: trimmedDisplayName?.length ? trimmedDisplayName : defaults.displayName,
      baseUrl, modelId, customModelId: trimmedCustomModelId?.length ? trimmedCustomModelId : undefined,
      enabled: input.enabled ?? true, connectionStatus: status,
      capabilities: capabilitiesFor(category, provider), secretConfigured: Boolean(apiKey), updatedAt: now, lastError,
      reasoningMode: input.reasoningMode, quality: input.quality, aspectRatio: input.aspectRatio,
    };
    const previousTargetSecret = this.#secretStore.get(targetSecret);
    const previousOldSecret = oldSecret === targetSecret ? previousTargetSecret : this.#secretStore.get(oldSecret);
    try {
      if (isDemo) await this.#secretStore.remove(targetSecret);
      else if (apiKey) await this.#secretStore.set(targetSecret, apiKey);
      if (oldSecret !== targetSecret) await this.#secretStore.remove(oldSecret);
      this.#records.set(category, record);
      await this.#persist();
      const verified = this.view(category);
      if (verified.provider !== provider || verified.modelId !== modelId || verified.secretConfigured !== Boolean(apiKey)) throw new SafeApiError("PROVIDER_CONFIG_VERIFY_FAILED", "Provider 配置保存后校验失败。", 500);
      return verified;
    } catch (error) {
      if (previous) this.#records.set(category, previous);
      else this.#records.delete(category);
      try {
        if (previousTargetSecret === undefined) await this.#secretStore.remove(targetSecret);
        else await this.#secretStore.set(targetSecret, previousTargetSecret);
        if (oldSecret !== targetSecret) {
          if (previousOldSecret === undefined) await this.#secretStore.remove(oldSecret);
          else await this.#secretStore.set(oldSecret, previousOldSecret);
        }
        await this.#persist();
      } catch {
        // Preserve the original actionable failure. The next process start will
        // load the last complete snapshot from the atomic files.
      }
      throw error;
    }
  }

  async setStatus(category: ProviderCategory, status: ConnectionStatus, lastError?: string, enabled?: boolean, errorCode?: string): Promise<ProviderConfigView> {
    const current = this.#records.get(category);
    if (!current) return this.view(category);
    const tested = status === "connected" || status === "error";
    this.#records.set(category, { ...current, connectionStatus: status, lastError, lastErrorCode: errorCode, lastTestedAt: tested ? new Date().toISOString() : current.lastTestedAt, ...(enabled === undefined ? {} : { enabled }), updatedAt: new Date().toISOString() });
    await this.#persist();
    return this.view(category);
  }

  async remove(category: ProviderCategory): Promise<ProviderConfigView> {
    const current = this.#records.get(category);
    if (!current) return this.view(category);
    const previousSecret = this.#secretStore.get(secretName(category, current.provider));
    this.#records.delete(category);
    try {
      await this.#secretStore.remove(secretName(category, current.provider));
      await this.#persist();
      return this.view(category);
    } catch (error) {
      this.#records.set(category, current);
      if (previousSecret) await this.#secretStore.set(secretName(category, current.provider), previousSecret);
      throw error;
    }
  }

  hasStored(category: ProviderCategory): boolean { return this.#records.has(category); }

  secret(category: ProviderCategory): string | undefined { return this.get(category).apiKey; }

  #environmentSecret(category: ProviderCategory, provider: ProviderName): string | undefined {
    if (category === "text" && canonicalProvider(provider) === "deepseek") return this.#serverConfig.deepseekApiKey;
    if (category === "image" && canonicalProvider(provider) === "openai") return this.#serverConfig.openaiApiKey;
    return undefined;
  }

  #fromEnvironment(category: ProviderCategory): StoredProviderConfig {
    const now = new Date().toISOString();
    const provider: ProviderName = category === "text" ? "deepseek" : this.#serverConfig.openaiApiKey ? "openai" : "demo-visual";
    const defaults = defaultFor(category, provider);
    const secretConfigured = Boolean(this.#environmentSecret(category, provider));
    const readyByDefault = category === "image" && provider === "demo-visual";
    return {
      id: `${category}-provider`, category, provider, displayName: defaults.displayName, baseUrl: category === "text" ? this.#serverConfig.deepseekBaseUrl : provider === "openai" ? this.#serverConfig.openaiBaseUrl : defaults.baseUrl,
      modelId: category === "text" ? this.#serverConfig.deepseekTextModel : provider === "openai" ? this.#serverConfig.openaiImageModel : defaults.modelId,
      enabled: secretConfigured || readyByDefault, connectionStatus: secretConfigured || readyByDefault ? "connected" : "unconfigured", capabilities: capabilitiesFor(category, provider), secretConfigured, updatedAt: now,
    };
  }

  #loadSync(): void {
    const path = existsSync(this.#filePath) ? this.#filePath : this.#legacyFilePath;
    let migrated = false;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      for (const category of ["text", "image"] as const) {
        const value = (parsed as Record<string, unknown>)[category];
        if (!value || typeof value !== "object") continue;
        const item = value as Partial<StoredProviderConfig> & { readonly apiKey?: unknown; readonly model?: unknown };
        if (typeof item.provider !== "string" || typeof item.baseUrl !== "string") continue;
        const providerResult = providerNameSchema.safeParse(item.provider);
        if (!providerResult.success) continue;
        const provider = canonicalProvider(providerResult.data);
        const defaults = defaultFor(category, provider);
        const legacyKey = typeof item.apiKey === "string" && item.apiKey.length > 0 ? item.apiKey : undefined;
        if (legacyKey) { this.#secretStore.setSync(secretName(category, provider), legacyKey); migrated = true; }
        const modelId = typeof item.modelId === "string" ? item.modelId : typeof item.model === "string" ? item.model : defaults.modelId;
        this.#records.set(category, {
          id: `${category}-provider`, category, provider, displayName: typeof item.displayName === "string" ? item.displayName : defaults.displayName,
          baseUrl: item.baseUrl, modelId, customModelId: item.customModelId, enabled: item.enabled !== false,
          connectionStatus: item.connectionStatus ?? (legacyKey ? "saved" : "unconfigured"), capabilities: capabilitiesFor(category, provider), secretConfigured: Boolean(legacyKey) || this.#secretStore.has(secretName(category, provider)), updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(), lastError: item.lastError, lastTestedAt: item.lastTestedAt, lastErrorCode: item.lastErrorCode, reasoningMode: item.reasoningMode, quality: item.quality, aspectRatio: item.aspectRatio,
        });
      }
      if (migrated && path === this.#legacyFilePath) {
        const directory = resolve(process.cwd(), this.#serverConfig.runtimeDirectory);
        const safePayload = JSON.stringify({ text: this.#records.get("text") ?? null, image: this.#records.get("image") ?? null }, null, 2);
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        writeFileSync(this.#filePath, safePayload, { encoding: "utf8", mode: 0o600 });
        writeFileSync(this.#legacyFilePath, JSON.stringify({ migrated: true, providers: "moved-to-encrypted-secret-store" }, null, 2), { encoding: "utf8", mode: 0o600 });
      }
    } catch {
      // A corrupt metadata file fails closed; the UI still receives a valid
      // default view and can save a fresh configuration.
    }
  }

  async #persist(): Promise<void> {
    const directory = resolve(process.cwd(), this.#serverConfig.runtimeDirectory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const payload = JSON.stringify({ text: this.#records.get("text") ?? null, image: this.#records.get("image") ?? null }, null, 2);
    const temporary = join(directory, `providers.${String(process.pid)}.${String(Date.now())}.tmp`);
    await writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, this.#filePath);
  }
}

export function providerViewToRuntime(config: ProviderConfigStore, category: ProviderCategory): ProviderRuntimeConfig {
  return config.get(category);
}
