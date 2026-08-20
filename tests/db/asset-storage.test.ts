import assert from "node:assert/strict";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import { AssetStorageError } from "../../src/domain/errors/index.js";
import { asEntityId } from "../../src/domain/shared/id.js";
import { IndexedDbAssetStorage } from "../../src/db/assetStorage.js";
import { createMuseDatabase } from "../../src/db/database.js";

let sequence = 0;
function fixture() {
  const database = createMuseDatabase(`asset-storage-${String(sequence++)}`, {
    dependencies: { indexedDB, IDBKeyRange },
  });
  return { database, storage: new IndexedDbAssetStorage(database) };
}

void test("AssetStorage preserves Blob type, size and content", async () => {
  const { database, storage } = fixture();
  const assetId = asEntityId("60000000-0000-4000-8000-000000000001");
  const content = new Blob(["muse-content"], { type: "text/plain" });
  await storage.save(assetId, content);

  const restored = await storage.get(assetId);
  assert.ok(restored);
  assert.equal(restored.type, "text/plain");
  assert.equal(restored.size, content.size);
  assert.equal(await restored.text(), "muse-content");
  assert.equal(await storage.has(assetId), true);
  database.close();
});

void test("AssetStorage overwrites atomically and deletes safely", async () => {
  const { database, storage } = fixture();
  const assetId = asEntityId("60000000-0000-4000-8000-000000000002");
  await storage.save(assetId, new Blob(["first"], { type: "text/plain" }));
  await storage.save(assetId, new Blob(["second"], { type: "text/markdown" }));
  assert.equal(await (await storage.get(assetId))?.text(), "second");
  assert.equal((await storage.get(assetId))?.type, "text/markdown");

  await storage.delete(assetId);
  assert.equal(await storage.has(assetId), false);
  assert.equal(await storage.get(assetId), undefined);
  await storage.delete(assetId);
  database.close();
});

void test("AssetStorage converts IndexedDB failures to a typed domain error", async () => {
  const { database, storage } = fixture();
  const assetId = asEntityId("60000000-0000-4000-8000-000000000003");
  await database.open();
  database.close({ disableAutoOpen: true });

  await assert.rejects(
    storage.save(assetId, new Blob(["blocked"])),
    (error: unknown) => {
      assert.ok(error instanceof AssetStorageError);
      assert.equal(error.code, "ASSET_STORAGE_FAILED");
      assert.deepEqual(error.context, { assetId, operation: "save" });
      return true;
    },
  );
});
