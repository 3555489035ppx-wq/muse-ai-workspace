import { z } from "zod";

export const aiOperationSchema = z.enum([
  "structured",
  "search",
  "vision",
  "image_generate",
  "image_edit",
  "demo_image_selection",
  "demo_variation_lookup",
  "review",
]);
export type AiOperation = z.infer<typeof aiOperationSchema>;

export const aiProjectCommandSchema = z.object({
  projectId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const structuredAiRequestSchema = aiProjectCommandSchema.extend({
  purpose: z.enum(["overview", "research", "research_plan", "insight", "moodboard", "direction", "exploration", "prompt", "review", "version", "project_brain", "concept", "visual_brief", "cmf", "decision_map"]),
  instruction: z.string().trim().min(1).max(12_000),
  schemaHint: z.record(z.string(), z.unknown()).optional(),
  enableSearch: z.boolean().default(false),
});
export type StructuredAiRequest = z.infer<typeof structuredAiRequestSchema>;

export const imageAiRequestSchema = aiProjectCommandSchema.extend({
  stage: z.enum(["concept", "cmf", "review"]).default("concept"),
  promptVersionId: z.uuid(),
  prompt: z.string().trim().min(1).max(5_000),
  negativePrompt: z.string().trim().max(2_000).optional(),
  sourceAssetUrls: z.array(z.string().trim().min(1).max(2_000)).max(9).default([]),
  size: z.enum(["1K", "2K"]).default("2K"),
});
export type ImageAiRequest = z.infer<typeof imageAiRequestSchema>;

export interface ProviderUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly imageCount?: number;
  readonly estimatedCostCny: number;
}

export interface ProviderTrace {
  readonly providerId: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly providerRequestId?: string;
  /** Safe diagnostics only; never include provider credentials or raw content. */
  readonly httpStatus?: number;
  readonly rawContentLength?: number;
  readonly parsed?: boolean;
  readonly usage: ProviderUsage;
}

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
}
export interface ApiFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean };
}
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface AiCapabilityView {
  readonly liveEnabled: boolean;
  readonly providerConfigured: boolean;
  readonly killSwitchActive: boolean;
  readonly providerLabel: string;
  readonly models: { readonly llm: string; readonly image: string };
  readonly capabilities: readonly AiOperation[];
  readonly limits: { readonly requestCny: number; readonly projectDailyCny: number };
  readonly providers: {
    readonly text: AiProviderCapability;
    readonly image: AiProviderCapability;
  };
  readonly mode: "real" | "partial" | "unavailable";
}

export interface AiProviderCapability {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly ready: boolean;
  readonly mode?: "real" | "demo";
  /** This provider is configured by the deployment, not the current visitor. */
  readonly managedBySite?: boolean;
  readonly capabilities: readonly AiOperation[];
  readonly configurationHint?: string;
}
