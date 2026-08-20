import assert from "node:assert/strict";
import test from "node:test";

import {
  AssetStorageError,
  DomainError,
  DuplicateEntityError,
  EntityNotFoundError,
  InvalidWorkflowTransitionError,
  ParentEntityMismatchError,
  ProjectScopeViolationError,
  ReferentialIntegrityError,
  StorageMigrationError,
} from "../../src/domain/errors/index.js";
import {
  asEntityId,
  asProjectId,
  createEntityId,
  createProjectId,
  isEntityId,
} from "../../src/domain/shared/id.js";
import {
  createTimestamps,
  isIsoTimestamp,
  requireIsoTimestamp,
  touchTimestamps,
} from "../../src/domain/shared/time.js";

void test("Domain errors expose stable code, context, cause and instanceof identity", () => {
  const cause = new Error("database unavailable");
  const errors = [
    new EntityNotFoundError("Project", "missing-id"),
    new ProjectScopeViolationError("project-a", "project-b", "asset-1"),
    new ParentEntityMismatchError("Moodboard", "mood-1", "project-a"),
    new InvalidWorkflowTransitionError("DRAFT", "LOCKED"),
    new StorageMigrationError(3, 4, cause),
    new ReferentialIntegrityError("asset-1", ["moodboard-1"]),
    new AssetStorageError("write", "blob-1", cause),
    new DuplicateEntityError("Project", "project-1"),
  ] as const;

  for (const error of errors) {
    assert.ok(error instanceof Error);
    assert.ok(error instanceof DomainError);
    assert.equal(typeof error.code, "string");
    assert.ok(error.code.length > 0);
    assert.equal(typeof error.context, "object");
    assert.ok(Object.isFrozen(error.context));
  }

  assert.equal(errors[0].code, "ENTITY_NOT_FOUND");
  assert.deepEqual(errors[0].context, {
    entityId: "missing-id",
    entityType: "Project",
  });
  assert.equal(errors[4].cause, cause);
  assert.equal(errors[6].cause, cause);
});

void test("DomainError supports an empty context and preserves a typed cause", () => {
  const cause = new Error("root");
  const error = new DomainError("CUSTOM", "custom message", undefined, cause);

  assert.equal(error.name, "DomainError");
  assert.equal(error.message, "custom message");
  assert.deepEqual(error.context, {});
  assert.equal(error.cause, cause);
});

void test("entity IDs are secure UUIDs and invalid values are rejected", () => {
  const id = createEntityId();

  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(isEntityId(id), true);
  assert.equal(isEntityId("not-a-uuid"), false);
  assert.equal(isEntityId(42), false);
  assert.equal(asEntityId(id), id);
  assert.equal(asProjectId(id), id);
  assert.equal(createProjectId({ randomUUID: () => id }), id);
  assert.throws(() => asEntityId("bad"), {
    code: "INVALID_ENTITY_ID",
  });
  assert.throws(() => createEntityId(null), {
    code: "UUID_GENERATION_FAILED",
    context: { reason: "unavailable" },
  });
  assert.throws(() => createEntityId({ randomUUID: () => "bad" }), {
    code: "UUID_GENERATION_FAILED",
    context: { reason: "invalid" },
  });
});

void test("ISO timestamp guards accept canonical UTC timestamps only", () => {
  const now = "2026-07-28T12:34:56.789Z";

  assert.equal(isIsoTimestamp(now), true);
  assert.equal(isIsoTimestamp("2026-07-28"), false);
  assert.equal(isIsoTimestamp("2026-02-30T00:00:00.000Z"), false);
  assert.equal(isIsoTimestamp(123), false);
  assert.equal(requireIsoTimestamp(now), now);
  assert.throws(() => requireIsoTimestamp("bad"), {
    code: "INVALID_ISO_TIMESTAMP",
  });
});

void test("timestamp helpers own createdAt and updatedAt maintenance", () => {
  const created = createTimestamps(new Date("2026-07-28T01:00:00.000Z"));
  const updated = touchTimestamps(
    created,
    new Date("2026-07-28T02:00:00.000Z"),
  );

  assert.deepEqual(created, {
    createdAt: "2026-07-28T01:00:00.000Z",
    updatedAt: "2026-07-28T01:00:00.000Z",
  });
  assert.deepEqual(updated, {
    createdAt: created.createdAt,
    updatedAt: "2026-07-28T02:00:00.000Z",
  });
  assert.equal(isIsoTimestamp(createTimestamps().createdAt), true);
  assert.equal(isIsoTimestamp(touchTimestamps(created).updatedAt), true);
});
