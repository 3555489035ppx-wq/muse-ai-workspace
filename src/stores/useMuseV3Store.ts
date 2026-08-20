import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Project } from "../domain/project/index.js";
import type { EntityId, ProjectId } from "../domain/shared/id.js";

export type UiOperationState = "idle" | "pending" | "success" | "error";
export type MigrationRecoveryState = "idle" | "required" | "recovering" | "failed";

export interface MuseSelection {
  readonly entityId?: EntityId;
  readonly entityType?: string;
}

export interface CanvasSessionState {
  readonly canvasId?: EntityId;
  readonly focusedNodeId?: EntityId;
}

export interface MuseV3StoreState {
  readonly activeProjectId?: ProjectId;
  readonly selection: MuseSelection;
  readonly operationState: UiOperationState;
  readonly canvasSession: CanvasSessionState;
  readonly migrationRecoveryState: MigrationRecoveryState;
  readonly migrationRecoveryMessage?: string;
}

export interface MuseV3StoreActions {
  setActiveProject(projectId?: ProjectId): void;
  setSelection(selection: MuseSelection): void;
  setOperationState(state: UiOperationState): void;
  setCanvasSession(session: CanvasSessionState): void;
  setMigrationRecovery(state: MigrationRecoveryState, message?: string): void;
  resetSession(): void;
}

export type MuseV3Store = MuseV3StoreState & MuseV3StoreActions;

const initialState: MuseV3StoreState = {
  selection: {},
  operationState: "idle",
  canvasSession: {},
  migrationRecoveryState: "idle",
};

export function createMuseV3Store(): StoreApi<MuseV3Store> {
  return createStore<MuseV3Store>((set) => ({
    ...initialState,
    setActiveProject: (activeProjectId) => { set({ activeProjectId, selection: {}, canvasSession: {} }); },
    setSelection: (selection) => { set({ selection }); },
    setOperationState: (operationState) => { set({ operationState }); },
    setCanvasSession: (canvasSession) => { set({ canvasSession }); },
    setMigrationRecovery: (migrationRecoveryState, migrationRecoveryMessage) => { set({ migrationRecoveryState, migrationRecoveryMessage }); },
    resetSession: () => { set(initialState); },
  }));
}

export const museV3Store = createMuseV3Store();

export function useMuseV3Store<T>(selector: (state: MuseV3Store) => T): T {
  return useStore(museV3Store, selector);
}

export interface ProjectQueryPort {
  get(id: ProjectId): Promise<Project | undefined>;
}

export async function queryActiveProject(store: StoreApi<MuseV3Store>, repository: ProjectQueryPort): Promise<Project | undefined> {
  const activeProjectId = store.getState().activeProjectId;
  return activeProjectId === undefined ? undefined : repository.get(activeProjectId);
}
