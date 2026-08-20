import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SafeApiError } from "../api/envelope.js";

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export class AssetStore {
  readonly #directory: string;
  constructor(runtimeDirectory: string) { this.#directory = join(runtimeDirectory, "assets"); }
  async put(id: string, bytes: Uint8Array, mimeType: keyof typeof EXTENSIONS): Promise<string> {
    await mkdir(this.#directory, { recursive: true });
    const name = `${id}.${EXTENSIONS[mimeType]}`;
    await writeFile(join(this.#directory, name), bytes, { mode: 0o600 });
    return name;
  }
  async get(name: string): Promise<{ readonly bytes: Buffer; readonly mimeType: keyof typeof EXTENSIONS }> {
    if (!/^[0-9a-f-]+\.(png|jpg|webp)$/i.test(name)) throw new SafeApiError("ASSET_NOT_FOUND", "生成资产不存在。", 404);
    const extension = name.split(".").at(-1);
    const mimeType = extension === "png" ? "image/png" : extension === "jpg" ? "image/jpeg" : "image/webp";
    try { return { bytes: await readFile(join(this.#directory, name)), mimeType }; } catch { throw new SafeApiError("ASSET_NOT_FOUND", "生成资产不存在。", 404); }
  }
}
