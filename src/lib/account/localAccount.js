import { db } from "../../db/database";
import { createId, now } from "../ids";

export const LOCAL_ACCOUNT_PREFERENCE = "account:local";

function normalizeAccount(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    displayName: String(value.displayName ?? "本地访客").trim() || "本地访客",
    email: String(value.email ?? "").trim(),
    mode: "local",
    createdAt: value.createdAt ?? now(),
    updatedAt: value.updatedAt ?? now(),
  };
}

export async function getLocalAccount(database = db) {
  const record = await database.preferences.get(LOCAL_ACCOUNT_PREFERENCE);
  return normalizeAccount(record?.value);
}

export async function ensureLocalAccount(database = db) {
  const existing = await getLocalAccount(database);
  if (existing) return existing;
  const timestamp = now();
  const account = {
    id: createId("account"),
    displayName: "本地访客",
    email: "",
    mode: "local",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await database.preferences.put({ id: LOCAL_ACCOUNT_PREFERENCE, value: account, updatedAt: timestamp });
  return account;
}

export async function updateLocalAccount(patch, database = db) {
  const current = await ensureLocalAccount(database);
  const next = normalizeAccount({ ...current, ...patch, id: current.id, updatedAt: now() });
  await database.preferences.put({ id: LOCAL_ACCOUNT_PREFERENCE, value: next, updatedAt: next.updatedAt });
  return next;
}
