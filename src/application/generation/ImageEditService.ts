import { DomainError } from "../../domain/errors/index.js";
import { createEntityId, type EntityId, type ProjectId } from "../../domain/shared/id.js";
import { getDefaultDatabase, type MuseDatabase } from "../../db/database.js";
import { GenerationRepository } from "../../repositories/GenerationRepository.js";
import { runWriteTransaction } from "../../repositories/transaction.js";
import { VersionRepository } from "../../repositories/VersionRepository.js";

export const PROTOTYPE_EDIT_TYPES = ["crop", "variation", "prompt_edit"] as const;
export type PrototypeEditType = (typeof PROTOTYPE_EDIT_TYPES)[number];
const DOMAIN_TYPE = { crop: "crop", variation: "color_adjust", prompt_edit: "color_adjust" } as const;
export interface ImageEditCommand { readonly projectId: ProjectId; readonly generatedAssetId: EntityId; readonly type: PrototypeEditType; readonly instruction: string; readonly resultGeneratedAssetId?: EntityId; }

export class ImageEditService {
  readonly #database: MuseDatabase; readonly #repository: GenerationRepository; readonly #versions: VersionRepository; readonly #ids: () => EntityId;
  constructor(database: MuseDatabase = getDefaultDatabase(), options: { readonly entityIdFactory?: () => EntityId } = {}) { this.#database = database; this.#repository = new GenerationRepository(database); this.#versions = new VersionRepository(database); this.#ids = options.entityIdFactory ?? createEntityId; }
  async create(command: ImageEditCommand) {
    if (!(PROTOTYPE_EDIT_TYPES as readonly string[]).includes(command.type)) throw new DomainError("INVALID_IMAGE_EDIT_TYPE", "Prototype edit supports crop, variation, or prompt_edit only.");
    if (!command.instruction.trim()) throw new DomainError("INVALID_IMAGE_EDIT", "Edit instruction is required.");
    const source = await this.#repository.getGeneratedAsset(command.generatedAssetId); if (!source || source.projectId !== command.projectId) throw new DomainError("INVALID_IMAGE_EDIT", "Source GeneratedAsset is missing or outside the project.");
    if (command.resultGeneratedAssetId) { const result = await this.#repository.getGeneratedAsset(command.resultGeneratedAssetId); if (!result || result.projectId !== command.projectId) throw new DomainError("INVALID_IMAGE_EDIT", "Provider result asset is invalid."); }
    const editId = this.#ids(); const snapshotId = this.#ids();
    await runWriteTransaction(this.#database, [this.#database.table("projects"), this.#database.table("promptVersions"), this.#database.table("assets"), this.#database.table("generatedAssets"), this.#database.table("imageEdits"), this.#database.table("versionSnapshots")], async () => {
      await this.#repository.createImageEdit({ id: editId, projectId: command.projectId, generatedAssetId: source.id, sourceAssetId: source.assetId, promptVersionId: source.promptVersionId, type: DOMAIN_TYPE[command.type], instruction: `[${command.type}] ${command.instruction.trim()}` });
      await this.#versions.create({ id: snapshotId, projectId: command.projectId, entityType: "generated_asset", entityId: source.id, schemaVersion: 1, label: "prototype:metadata-operation", snapshot: { editId, type: command.type, instruction: command.instruction.trim(), sourceGeneratedAssetId: source.id, resultGeneratedAssetId: command.resultGeneratedAssetId ?? null, prototype: true } });
    });
    return { editId, snapshotId, resultGeneratedAssetId: command.resultGeneratedAssetId };
  }
}
