import { z } from "zod";

export const providerCategorySchema = z.enum(["text", "image"]);
export type ProviderCategory = z.infer<typeof providerCategorySchema>;

export const providerNameSchema = z.enum(["deepseek", "openai", "gemini", "anthropic", "custom", "custom-openai-compatible", "demo-visual"]);
export type ProviderName = z.infer<typeof providerNameSchema>;

export const connectionStatusSchema = z.enum(["unconfigured", "saved", "testing", "connected", "error"]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const providerConfigInputSchema = z.object({
  provider: providerNameSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
  baseUrl: z.string().trim().max(500).optional(),
  modelId: z.string().trim().max(180).optional(),
  /** @deprecated Use modelId. Kept for existing local projects during migration. */
  model: z.string().trim().max(180).optional(),
  customModelId: z.string().trim().max(180).optional(),
  enabled: z.boolean().optional(),
  reasoningMode: z.enum(["off", "standard", "high", "max"]).optional(),
  quality: z.enum(["standard", "high"]).optional(),
  aspectRatio: z.enum(["square", "landscape", "portrait"]).optional(),
  apiKey: z.string().trim().min(1).max(1024).optional(),
});
export type ProviderConfigInput = z.infer<typeof providerConfigInputSchema>;

export const providerCreateRequestSchema = providerConfigInputSchema.extend({ category: providerCategorySchema });
export const providerPatchRequestSchema = providerConfigInputSchema.partial();

export const providerTestRequestSchema = z.object({
  config: providerConfigInputSchema.partial().optional(),
  persist: z.boolean().default(false),
});

export interface ProviderConfigView {
  readonly id: string;
  readonly category: ProviderCategory;
  readonly provider: ProviderName;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly modelId: string;
  /** @deprecated Use modelId. Returned temporarily for older local clients. */
  readonly model: string;
  readonly customModelId?: string;
  readonly enabled: boolean;
  readonly reasoningMode?: "off" | "standard" | "high" | "max";
  readonly quality?: "standard" | "high";
  readonly aspectRatio?: "square" | "landscape" | "portrait";
  readonly connectionStatus: ConnectionStatus;
  readonly secretConfigured: boolean;
  readonly keyHint?: string;
  readonly capabilities: readonly string[];
  readonly updatedAt?: string;
  readonly lastError?: string;
  readonly lastTestedAt?: string;
  readonly lastErrorCode?: string;
}
