import type { AiOperation, ProviderTrace } from "../contracts/ai.js";

export interface ProviderDescriptor {
  readonly id: string;
  readonly label: string;
  readonly region: "cn-beijing" | "global";
  readonly model: string;
  readonly modelVersion: string;
  readonly capabilities: readonly AiOperation[];
  readonly configured: boolean;
}

export interface StructuredProviderResult {
  readonly value: Readonly<Record<string, unknown>>;
  readonly trace: ProviderTrace;
}
export interface StructuredProvider {
  readonly descriptor: ProviderDescriptor;
  complete(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult>;
  testConnection?(signal?: AbortSignal): Promise<{ readonly provider: string; readonly model: string; readonly latencyMs: number; readonly status: "connected" }>;
  structuredGenerate?(input: { readonly instruction: string; readonly purpose: string; readonly enableSearch: boolean; readonly schemaHint?: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }): Promise<StructuredProviderResult>;
}

export interface ResearchSearchResult {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly publishedAt?: string | null;
  readonly snippet: string;
  readonly rawContent?: string;
  readonly contentStatus: "full" | "snippet";
  readonly score?: number;
  readonly favicon?: string | null;
}

export interface SearchProviderResult {
  readonly query: string;
  readonly results: readonly ResearchSearchResult[];
  readonly trace: ProviderTrace;
}

export interface SearchProvider {
  readonly descriptor: ProviderDescriptor;
  search(input: { readonly query: string; readonly maxResults: number; readonly signal?: AbortSignal }): Promise<SearchProviderResult>;
}

export interface ImageProviderResult {
  readonly bytes: Uint8Array;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly width?: number;
  readonly height?: number;
  readonly trace: ProviderTrace;
}
export interface ProviderSourceImage {
  readonly bytes: Uint8Array;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly name: string;
}
export interface ImageProvider {
  readonly descriptor: ProviderDescriptor;
  generate(input: { readonly prompt: string; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult>;
  edit(input: { readonly prompt: string; readonly sourceImages: readonly ProviderSourceImage[]; readonly size: "1K" | "2K"; readonly signal?: AbortSignal }): Promise<ImageProviderResult>;
}
