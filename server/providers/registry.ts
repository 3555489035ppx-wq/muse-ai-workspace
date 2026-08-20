import { SafeApiError } from "../api/envelope.js";
import type { AiOperation } from "../contracts/ai.js";
import type { ImageProvider, ProviderDescriptor, StructuredProvider } from "./types.js";

type RegisteredProvider = StructuredProvider | ImageProvider;
export class ProviderRegistry {
  readonly #providers = new Map<string, RegisteredProvider>();
  register(provider: RegisteredProvider): void {
    if (this.#providers.has(provider.descriptor.id)) throw new SafeApiError("DUPLICATE_PROVIDER", "AI Provider 标识重复。", 500);
    this.#providers.set(provider.descriptor.id, provider);
  }
  replaceByCapability(operation: AiOperation, provider?: RegisteredProvider): void {
    for (const [id, candidate] of this.#providers) {
      if (candidate.descriptor.capabilities.includes(operation)) this.#providers.delete(id);
    }
    if (provider) this.#providers.set(provider.descriptor.id, provider);
  }
  descriptors(): readonly ProviderDescriptor[] { return [...this.#providers.values()].map((provider) => provider.descriptor); }
  require(operation: AiOperation): RegisteredProvider {
    const provider = [...this.#providers.values()].find((candidate) => candidate.descriptor.configured && candidate.descriptor.capabilities.includes(operation));
    if (!provider) throw new SafeApiError("UNSUPPORTED_OPERATION", "当前没有可用的 AI 能力。", 503);
    return provider;
  }
}
