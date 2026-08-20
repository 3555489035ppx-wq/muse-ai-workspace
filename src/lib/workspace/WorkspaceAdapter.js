import { liveQuery } from 'dexie';
import { db } from '../database';
import { matchesCollection, normalizeCollection } from './collectionRules';

/**
 * Muse-local workspace engine. The public methods deliberately mirror the
 * document/blob/index/presence boundaries of a collaborative workspace so the
 * backing implementation can later be replaced without changing product pages.
 */
export class DexieWorkspaceAdapter {
  constructor(workspaceId = 'local') {
    this.workspaceId = workspaceId;
    this.presence = new Map();
  }

  async putDocument(document) {
    const timestamp = new Date().toISOString();
    const next = { ...document, workspaceId: this.workspaceId, updatedAt: timestamp, createdAt: document.createdAt ?? timestamp };
    await db.workspaceDocuments.put(next);
    return next;
  }

  getDocument(id) {
    return db.workspaceDocuments.get(id);
  }

  async listDocuments() {
    return db.workspaceDocuments.where('workspaceId').equals(this.workspaceId).toArray();
  }

  watchDocuments(listener) {
    const subscription = liveQuery(() => this.listDocuments()).subscribe({ next: listener });
    return () => subscription.unsubscribe();
  }

  async putBlob(id, blob, metadata = {}) {
    const record = { id, workspaceId: this.workspaceId, blob, metadata, updatedAt: new Date().toISOString() };
    await db.workspaceBlobs.put(record);
    return record;
  }

  async getBlob(id) {
    return (await db.workspaceBlobs.get(id))?.blob;
  }

  async search(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return this.listDocuments();
    return (await this.listDocuments()).filter((document) =>
      [document.title, document.content, ...(document.tags ?? [])].some((value) => String(value ?? '').toLowerCase().includes(needle)),
    );
  }

  async putCollection(collection) {
    const next = normalizeCollection({ ...collection, workspaceId: this.workspaceId });
    await db.collections.put(next);
    return next;
  }

  async listCollections() {
    return db.collections.where('workspaceId').equals(this.workspaceId).toArray();
  }

  async resolveCollection(collectionId) {
    const collection = await db.collections.get(collectionId);
    if (!collection) return [];
    return (await this.listDocuments()).filter((document) => matchesCollection(document, collection));
  }

  setPresence(userId, state) {
    this.presence.set(userId, { ...state, updatedAt: Date.now() });
  }

  getPresence() {
    return [...this.presence.entries()].map(([userId, state]) => ({ userId, ...state }));
  }
}
