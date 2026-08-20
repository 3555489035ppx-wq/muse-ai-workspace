import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { MuseServerConfig } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;
const KEY_BYTES = 32;

interface EncryptedSecretFile {
  readonly version: number;
  readonly algorithm: typeof ALGORITHM;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

function decodeConfiguredKey(value: string | undefined): Buffer | undefined {
  if (!value?.trim()) return undefined;
  const clean = value.trim();
  const decoded = /^[0-9a-f]{64}$/i.test(clean)
    ? Buffer.from(clean, "hex")
    : Buffer.from(clean, "base64");
  if (decoded.byteLength !== KEY_BYTES) throw new Error("MUSE_SECRET_STORE_KEY must decode to 32 bytes.");
  return decoded;
}

/**
 * Server-only encrypted storage for provider credentials.
 *
 * Provider Config files contain metadata only. The API key is encrypted with
 * AES-256-GCM and is never returned to the browser or written to an AI run.
 */
export class SecretStore {
  readonly #directory: string;
  readonly #secretPath: string;
  readonly #keyPath: string;
  readonly #key: Buffer;
  readonly #secrets = new Map<string, string>();

  constructor(serverConfig: MuseServerConfig) {
    this.#directory = resolve(process.cwd(), serverConfig.runtimeDirectory);
    this.#secretPath = join(this.#directory, "secrets.json.enc");
    this.#keyPath = join(this.#directory, "secret-store.key");
    this.#key = this.#loadKey(serverConfig.secretStoreKey);
    this.#loadSync();
  }

  get(name: string): string | undefined { return this.#secrets.get(name); }
  has(name: string): boolean { return this.#secrets.has(name); }

  /** Used only by the one-time legacy provider-config migration. */
  setSync(name: string, value: string): void {
    this.#secrets.set(name, value);
    this.#persistSync();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async set(name: string, value: string): Promise<void> {
    const previous = this.#secrets.get(name);
    this.#secrets.set(name, value);
    try {
      this.#persistSync();
    } catch (error) {
      if (previous === undefined) this.#secrets.delete(name);
      else this.#secrets.set(name, previous);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async remove(name: string): Promise<void> {
    const previous = this.#secrets.get(name);
    if (previous === undefined) return;
    this.#secrets.delete(name);
    try {
      this.#persistSync();
    } catch (error) {
      this.#secrets.set(name, previous);
      throw error;
    }
  }

  #loadKey(configuredKey: string | undefined): Buffer {
    const fromEnvironment = decodeConfiguredKey(configuredKey);
    if (fromEnvironment) return fromEnvironment;
    try {
      const stored = readFileSync(this.#keyPath);
      if (stored.byteLength === KEY_BYTES) return stored;
    } catch {
      // A first run has no local key yet. It will be written with the first secret.
    }
    return randomBytes(KEY_BYTES);
  }

  #loadSync(): void {
    if (!existsSync(this.#secretPath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.#secretPath, "utf8")) as Partial<EncryptedSecretFile>;
      if (parsed.version !== VERSION || parsed.algorithm !== ALGORITHM || !parsed.iv || !parsed.authTag || !parsed.ciphertext) return;
      const decipher = createDecipheriv(ALGORITHM, this.#key, Buffer.from(parsed.iv, "base64"));
      decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64")), decipher.final()]).toString("utf8");
      const values = JSON.parse(plaintext) as Record<string, unknown>;
      for (const [name, value] of Object.entries(values)) if (typeof value === "string" && value.length > 0) this.#secrets.set(name, value);
    } catch {
      // A corrupt secret file fails closed. Provider Config remains readable as
      // non-sensitive metadata and the UI can ask the user to reconnect.
      this.#secrets.clear();
    }
  }

  #persistSync(): void {
    mkdirSync(this.#directory, { recursive: true, mode: 0o700 });
    // Persist the generated local key separately so a normal process restart can
    // decrypt the store. Deployments can instead provide MUSE_SECRET_STORE_KEY.
    if (!existsSync(this.#keyPath)) {
      writeFileSync(this.#keyPath, this.#key, { mode: 0o600 });
      chmodSync(this.#keyPath, 0o600);
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.#key, iv);
    const plaintext = Buffer.from(JSON.stringify(Object.fromEntries(this.#secrets)), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const payload: EncryptedSecretFile = {
      version: VERSION,
      algorithm: ALGORITHM,
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    const temporary = join(this.#directory, `secrets.${String(process.pid)}.${String(Date.now())}.tmp`);
    writeFileSync(temporary, JSON.stringify(payload, null, 2), { encoding: "utf8", mode: 0o600 });
    chmodSync(temporary, 0o600);
    renameSync(temporary, this.#secretPath);
  }
}
