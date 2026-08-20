import { isEntityId } from "../shared/id.js";
import { isIsoTimestamp } from "../shared/time.js";
import { ASSET_SOURCE_TYPES, ASSET_STATUSES, ASSET_TYPES, type Asset, type AssetAnalysis, type AssetCollection, type AssetSource } from "./types.js";

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function entity(value: Record<string, unknown>): boolean { return isEntityId(value.id) && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt); }
function scoped(value: Record<string, unknown>): boolean { return entity(value) && isEntityId(value.projectId); }
function scalarRecord(value: unknown): boolean { return record(value) && Object.values(value).every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean"); }
export function isAsset(value: unknown): value is Asset { return record(value) && entity(value) && text(value.name) && ASSET_TYPES.some((type) => type === value.type) && ASSET_STATUSES.some((status) => status === value.status) && text(value.mimeType) && typeof value.byteSize === "number" && Number.isInteger(value.byteSize) && value.byteSize >= 0 && text(value.storageKey); }
export function isAssetSource(value: unknown): value is AssetSource { return record(value) && scoped(value) && isEntityId(value.assetId) && ASSET_SOURCE_TYPES.some((type) => type === value.type) && (value.sourceId === undefined || isEntityId(value.sourceId)) && text(value.label); }
export function isAssetAnalysis(value: unknown): value is AssetAnalysis { return record(value) && scoped(value) && isEntityId(value.assetId) && (value.kind === "metadata" || value.kind === "visual") && scalarRecord(value.values); }
export function isAssetCollection(value: unknown): value is AssetCollection { return record(value) && scoped(value) && text(value.name) && Array.isArray(value.assetIds) && value.assetIds.every(isEntityId); }
