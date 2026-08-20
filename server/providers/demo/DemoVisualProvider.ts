import { SafeApiError } from "../../api/envelope.js";
import type { ImageProvider, ImageProviderResult } from "../types.js";

/**
 * Demo Visual is an explicit, non-live visual provider. The product's local
 * demo asset service owns selection and variation lookup; this registry entry
 * makes that state visible without pretending that a paid image API ran.
 */
export class DemoVisualProvider implements ImageProvider {
  readonly descriptor = {
    id: "demo-visual",
    label: "Demo Visual",
    region: "global" as const,
    model: "demo-visual",
    modelVersion: "demo-visual",
    capabilities: ["demo_image_selection", "demo_variation_lookup"] as const,
    configured: true,
  };

  generate(): Promise<ImageProviderResult> {
    throw new SafeApiError("DEMO_VISUAL_NOT_LIVE", "Demo Visual 使用当前项目的演示资产，不发起真实生图请求。", 422);
  }

  edit(): Promise<ImageProviderResult> {
    throw new SafeApiError("DEMO_VISUAL_NOT_LIVE", "Demo Visual 使用当前项目的演示资产，不发起真实图片编辑请求。", 422);
  }
}
