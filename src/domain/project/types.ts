import type { Entity, ProjectScopedEntity } from "../shared/entity.js";

export const PROJECT_TYPES = ["brand", "editorial", "ui", "campaign"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = ["draft", "active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STAGES = [
  "brief",
  "research",
  "moodboard",
  "direction",
  "exploration",
  "generation",
  "review",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_OUTPUT_TYPES = [
  "brand_identity",
  "poster",
  "social_media",
  "packaging",
  "digital_experience",
] as const;
export type ProjectOutputType = (typeof PROJECT_OUTPUT_TYPES)[number];

export interface ProjectSettings {
  readonly locale: "zh-CN";
  readonly timezone: string;
  readonly colorMode?: "dark" | "light" | "system";
}

export interface ProjectOverviewConflict {
  readonly title: string;
  readonly explanation: string;
  readonly sideA?: string;
  readonly sideB?: string;
  readonly whyConflict?: string;
  readonly riskIfOverIndexA?: string;
  readonly riskIfOverIndexB?: string;
  readonly researchImplication?: string;
}

export interface ProjectOverviewTargetUser {
  readonly primary: string;
  readonly traits: readonly string[];
}

export const INFORMATION_ORIGINS = ["explicit", "inferred", "suggested"] as const;
export type InformationOrigin = (typeof INFORMATION_ORIGINS)[number];

export const OUTCOME_CATEGORIES = [
  "Design Output",
  "Research Output",
  "Decision Output",
  "Presentation Output",
  "Validation Output",
] as const;
export type OutcomeCategory = (typeof OUTCOME_CATEGORIES)[number];

export interface BriefItem {
  readonly id: string;
  readonly label: string;
  readonly origin: InformationOrigin;
  readonly sourceText?: string;
}

export interface ExpectedOutcome {
  readonly id: string;
  readonly label: string;
  readonly category: OutcomeCategory;
  readonly sourceText?: string;
  readonly origin: "explicit";
}

export interface SuggestedOutcome {
  readonly id: string;
  readonly label: string;
  readonly category: OutcomeCategory;
  readonly rationale: string;
  readonly accepted: boolean;
  readonly origin: "suggested";
}

export interface ProjectExpectedOutcomes {
  readonly explicit: readonly ExpectedOutcome[];
  readonly suggested: readonly SuggestedOutcome[];
}

export interface Assumption extends BriefItem {
  readonly origin: "inferred";
  readonly status: "to_validate";
}

export interface Unknown extends BriefItem {
  readonly status: "unknown";
}

export interface Criterion extends BriefItem {
  readonly status?: "initial";
}

export interface ResearchQuestion extends BriefItem {
  readonly origin: "inferred";
}

export const DESIGN_DOMAINS = [
  "product_design",
  "industrial_design",
  "brand_design",
  "spatial_design",
  "uiux",
  "mixed_brand_spatial",
  "general_design",
] as const;
export type DesignDomain = (typeof DESIGN_DOMAINS)[number];

export interface DesignDomainContext {
  readonly primary: DesignDomain;
  readonly secondary?: DesignDomain;
  readonly mode: DesignDomain;
}

export interface DesignBrief {
  readonly projectId: string;
  readonly domain: DesignDomainContext;
  readonly coreDesignQuestion: string;
  readonly designObjective: string;
  readonly coreTension: ProjectOverviewConflict;
  readonly targetUser: {
    readonly primary: string;
    readonly relevantTraits: readonly string[];
  };
  readonly referenceContext: readonly string[];
  readonly coreScenario: string;
  readonly designRequirements: readonly BriefItem[];
  readonly designConstants: readonly BriefItem[];
  readonly designExclusions: readonly BriefItem[];
  readonly expectedOutcomes: ProjectExpectedOutcomes;
  readonly assumptions: readonly Assumption[];
  readonly unknowns: readonly Unknown[];
  readonly initialSuccessCriteria: readonly Criterion[];
  readonly researchQuestions: readonly ResearchQuestion[];
  readonly workflowRequirements: readonly string[];
  readonly status: "draft" | "confirmed";
  readonly confirmedAt?: string | null;
}

export interface ProjectOverview {
  readonly projectName: string;
  readonly projectType: readonly string[];
  readonly location?: string | null;
  readonly timeContext?: string | null;
  readonly projectSummary: string;
  readonly designGoal: string;
  readonly coreConflict: ProjectOverviewConflict;
  readonly targetUser: ProjectOverviewTargetUser;
  readonly keywords: readonly string[];
  readonly mustKeep: readonly string[];
  readonly mustAvoid: readonly string[];
  readonly deliverables: readonly string[];
  readonly successCriteria: readonly string[];
  readonly openQuestions: readonly string[];
  readonly confidenceNotes?: readonly string[];
  readonly designConstants?: readonly BriefItem[];
  readonly designExclusions?: readonly BriefItem[];
  readonly expectedOutcomes?: ProjectExpectedOutcomes;
  readonly outcomeDefinition?: string;
}

/**
 * A persisted candidate produced by the first understanding pass.
 * Keeping both layers together prevents a regenerated overview from silently
 * replacing the brief draft that was reviewed with it.
 */
export interface ProjectUnderstandingVersion {
  readonly id: string;
  readonly version: number;
  readonly createdAt: string;
  readonly source: "live" | "local" | "user";
  readonly projectOverview: ProjectOverview;
  readonly designBrief: DesignBrief;
}

export interface OriginalBriefSnapshot {
  readonly schemaVersion: number;
  readonly projectName: string;
  readonly designGoal: string;
  readonly audience: string;
  readonly context: string;
  readonly deliverables: readonly string[];
  readonly constraints: readonly string[];
  readonly keywords: readonly string[];
  readonly avoid: readonly string[];
}

export interface Project extends Entity {
  readonly name: string;
  readonly description?: string;
  /** Browser-local account scope; starter projects use the reserved "starter" owner. */
  readonly ownerId?: string;
  readonly ownerScope?: "user" | "starter";
  /** User-created projects remain drafts until the human confirmation gate. */
  readonly isDraft?: boolean;
  readonly progress?: number;
  readonly creationReady?: boolean;
  readonly type: ProjectType;
  readonly status: ProjectStatus;
  readonly stage: ProjectStage;
  readonly outputTypes: readonly ProjectOutputType[];
  readonly settings: ProjectSettings;
  readonly schemaVersion: number;
  readonly originalBrief?: OriginalBriefSnapshot;
  readonly projectOverview?: ProjectOverview;
  readonly overviewVersion?: number;
  readonly lastOverviewGeneratedAt?: string | null;
  readonly overviewUserEditedFields?: readonly string[];
  readonly overviewStale?: boolean;
  /** First-pass understanding state. Optional for V1-V3 records and demos. */
  readonly projectUnderstandingStatus?: "idle" | "queued" | "running" | "success" | "error";
  readonly projectUnderstandingError?: string | null;
  readonly projectUnderstandingSource?: "live" | "local" | "user";
  readonly projectUnderstandingVersion?: number;
  readonly projectUnderstandingCurrentVersionId?: string | null;
  readonly projectUnderstandingVersions?: readonly ProjectUnderstandingVersion[];
  readonly projectUnderstandingConfirmedAt?: string | null;
  readonly designBrief?: DesignBrief;
  readonly briefStatus?: "draft" | "confirmed";
  readonly briefConfirmedAt?: string | null;
  readonly briefVersion?: number;
  readonly briefStale?: boolean;
  readonly briefUserEditedFields?: readonly string[];
  readonly researchWorkspace?: ResearchWorkspace;
  readonly designInsights?: readonly DesignInsight[];
  readonly confirmedInsightIds?: readonly string[];
  readonly designInsightContextSignature?: string;
  readonly directionContext?: DirectionContext;
  readonly directionContextSignature?: string;
  readonly designDirections?: readonly DesignDirection[];
  readonly directionGenerationMeta?: Record<string, unknown>;
  readonly directionRecommendation?: Record<string, unknown>;
  readonly lockedDirection?: LockedDirection | null;
  /** V4 canonical cross-stage source. Older projects may omit it and are migrated on read. */
  readonly projectBrain?: Partial<ProjectBrain>;
}

export type ResearchSourceType = "user_paste" | "user_upload" | "url" | "document" | "external_search";
export type ResearchEvidenceType = "verified" | "candidate";
export type ResearchEvidenceStatus = "unreviewed" | "accepted" | "rejected" | "saved";

export interface ResearchSourceRecord {
  readonly id: string;
  readonly type: ResearchSourceType;
  readonly name: string;
  readonly sourceTitle?: string;
  readonly sourcePublisher?: string;
  readonly sourceDate?: string;
  readonly sourceUrl?: string | null;
  readonly sourceFileId?: string | null;
  readonly mimeType?: string | null;
  readonly originalExcerpt?: string;
  readonly userProvidedSource?: boolean;
  readonly capturedAt: string;
  readonly thumbnailUrl?: string | null;
  readonly limitations?: string;
}

export interface ResearchEvidenceRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly type: ResearchEvidenceType;
  readonly userStatus: ResearchEvidenceStatus;
  readonly verificationStatus: "verified" | "unverified" | "source_checked";
  readonly title: string;
  readonly sourceType: ResearchSourceType;
  readonly sourceTypeLabel: string;
  readonly sourceName: string;
  readonly sourceTitle?: string;
  readonly sourcePublisher?: string;
  readonly sourceDate?: string;
  readonly sourceUrl?: string | null;
  readonly sourceFileId?: string | null;
  readonly userProvidedSource?: boolean;
  readonly originalExcerpt: string;
  readonly fact?: string;
  readonly interpretation: string;
  readonly designImplication: string;
  readonly limitations?: string;
  readonly confidence: "high" | "medium" | "low";
  readonly questionIds: readonly string[];
  readonly lensIds?: readonly string[];
  readonly traceableSource: boolean;
  readonly capturedAt: string;
}

export interface ResearchHypothesisRecord {
  readonly id: string;
  readonly label: string;
  readonly status: "unverified" | "supported" | "rejected";
  readonly derivedFromQuestionIds: readonly string[];
  readonly whyItMatters: string;
  readonly howToValidate: string;
}

export interface ResearchAssistantPlan {
  readonly id: string;
  readonly questionId: string;
  readonly question: string;
  readonly whyThisMatters: string;
  readonly evidenceNeed: string;
  readonly querySuggestions: readonly string[];
  readonly preferredSources: readonly string[];
}

export interface ResearchAssistantState {
  readonly schemaVersion: 1;
  readonly status: "idle" | "processing" | "success" | "partial" | "error";
  readonly source: "none" | "live" | "user";
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly runId?: string | null;
  readonly generatedAt?: string | null;
  readonly questionPlans: readonly ResearchAssistantPlan[];
  readonly gaps: readonly string[];
  readonly nextActions: readonly string[];
  readonly errorMessage?: string | null;
  readonly note: string;
}

export interface ResearchWorkspace {
  readonly schemaVersion: 3;
  readonly projectId: string;
  readonly mode: "limited" | "provider" | "public_source_fixture";
  readonly providerStatus: "unavailable" | "available" | "fixture_ready" | "error";
  readonly status: "idle" | "collecting" | "reviewing";
  readonly questions: readonly ResearchQuestion[];
  readonly lenses: readonly { id: string; label: string; description: string; domain: string }[];
  readonly sources: readonly ResearchSourceRecord[];
  readonly evidence: readonly ResearchEvidenceRecord[];
  readonly hypotheses: readonly ResearchHypothesisRecord[];
  readonly researchAssistant?: ResearchAssistantState;
  readonly plan?: readonly { id: string; questionId: string; order: number; status: string; label: string }[];
  readonly evidenceLimited: boolean;
  readonly researchSummary: string;
  readonly coverage: readonly { id: string; label: string; description: string; acceptedEvidenceCount: number; status: string }[];
  readonly insightGate: { acceptedEvidenceCount: number; questionCount: number; sourceCount: number; ready: boolean };
}

export type DesignInsightEvidenceStrength = "strong" | "medium" | "preliminary";
export type DesignInsightStatus = "candidate" | "confirmed" | "rejected" | "edited";

export interface DesignInsight {
  readonly id: string;
  readonly title: string;
  readonly insightStatement: string;
  readonly patternSummary: string;
  readonly inferenceType?: "cross_evidence_pattern" | "single_evidence_hypothesis";
  readonly whyItMatters: string;
  readonly designImplication: string;
  readonly evidenceIds: readonly string[];
  readonly evidenceStrength: DesignInsightEvidenceStrength;
  readonly relatedBriefFields: readonly string[];
  readonly status: DesignInsightStatus;
  readonly userEdited: boolean;
}

export type DirectionSupportLevel = "supported" | "partial" | "preliminary";
export type DesignDirectionStatus = "candidate" | "confirmed" | "rejected" | "locked";

export interface DirectionContext {
  readonly projectId?: string;
  readonly projectName?: string;
  readonly domain: {
    readonly mode: DesignDomain;
    readonly primary: DesignDomain;
    readonly secondary?: DesignDomain | null;
    readonly label?: string;
  };
  readonly coreDesignQuestion: string;
  readonly designObjective: string;
  readonly coreTension: string;
  readonly targetUser: string;
  readonly coreScenario: string;
  readonly designRequirements: readonly string[];
  readonly designConstants: readonly string[];
  readonly designExclusions: readonly string[];
  readonly successCriteria: readonly string[];
  readonly acceptedEvidence: readonly Record<string, unknown>[];
  readonly confirmedInsights: readonly Record<string, unknown>[];
}

export interface DesignDirection {
  readonly id: string;
  readonly code?: string;
  readonly name: string;
  readonly subtitle?: string;
  readonly thesis: string;
  readonly strategicIdea: string;
  readonly userValue: string;
  readonly evidenceIds: readonly string[];
  readonly insightIds: readonly string[];
  readonly brandLogic?: string;
  readonly culturalLogic?: string;
  readonly visualLogic?: string;
  readonly spatialLogic?: string;
  readonly experienceLogic?: string;
  readonly interactionLogic?: string;
  readonly formLogic?: string;
  readonly materialLogic?: string;
  readonly communicationLogic?: string;
  readonly fundamentalDifference?: string;
  readonly strategicMechanism?: string;
  readonly problemSolved?: string;
  readonly whyNow?: string;
  readonly designConsequences?: readonly string[];
  readonly biggestRisk?: string;
  readonly validationQuestion?: string;
  readonly advantages: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly risks: readonly string[];
  readonly validationQuestions: readonly string[];
  readonly successSignals: readonly string[];
  readonly mustKeep: readonly string[];
  readonly mustAvoid: readonly string[];
  readonly supportLevel: DirectionSupportLevel;
  readonly status: DesignDirectionStatus;
  readonly strategyKey?: string;
  readonly keywords?: readonly string[];
  readonly comparison?: Record<string, unknown>;
  readonly comparisonReasons?: readonly string[];
  readonly evidenceSourceCount?: number;
  readonly image?: string | null;
  readonly imageSource?: string;
}

export interface LockedDirection {
  readonly directionId: string;
  readonly selectedAt: string;
  readonly userReason?: string;
  readonly thesis: string;
  readonly evidenceIds: readonly string[];
  readonly insightIds: readonly string[];
  readonly designRules: readonly string[];
  readonly risks: readonly string[];
  readonly validationQuestions: readonly string[];
}

export interface ProjectBrief extends ProjectScopedEntity {
  readonly goal: string;
  readonly audience: string;
  readonly context: string;
  readonly deliverables: readonly string[];
  readonly constraints: readonly string[];
  readonly keywords?: readonly string[];
  readonly avoid?: readonly string[];
}

export type MuseAiStage = "brief" | "research" | "insight" | "direction" | "concept" | "visual" | "cmf" | "review" | "version" | "decision-map";
export type ContentOrigin = "real_ai" | "demo_seed" | "cached_ai" | "user";

export interface GeneratedVisualProvenance {
  readonly id: string;
  readonly stage?: "concept" | "cmf" | "review" | "version";
  readonly provider: string;
  readonly model: string;
  readonly generatedAt: string;
  readonly directionId: string;
  readonly conceptId: string;
  readonly generationBrief: string;
  readonly variation: string;
  readonly imageUrl: string;
  readonly visualMode?: "real-ai" | "demo-asset";
  readonly parentVisualId?: string;
  readonly versionId?: string;
  readonly contentOrigin?: ContentOrigin;
}

export interface DemoVisualRecord {
  readonly id: string;
  readonly projectId: string;
  readonly stage: "concept" | "cmf" | "review" | "version";
  readonly variant: string;
  readonly directionId?: string | null;
  readonly conceptId?: string | null;
  readonly cmfId?: string | null;
  readonly imagePath: string;
  readonly imageUrl?: string;
  readonly imageSource: "demo-asset";
  readonly visualMode: "demo-asset";
  readonly visualDescription?: string;
  readonly visualAttributes?: Readonly<Record<string, unknown>>;
  readonly parentVisualId?: string | null;
  readonly contentOrigin: "demo_seed";
}

export interface ProjectBrain {
  readonly projectId: string;
  readonly projectName: string;
  readonly domain: "industrial" | "brand-spatial" | "digital";
  readonly originalBrief: Readonly<Record<string, unknown>>;
  readonly projectOverview: Readonly<Record<string, unknown>>;
  readonly designBrief: Readonly<Record<string, unknown>>;
  readonly acceptedEvidence: readonly Readonly<Record<string, unknown>>[];
  readonly confirmedInsights: readonly Readonly<Record<string, unknown>>[];
  readonly directionCandidates: readonly Readonly<Record<string, unknown>>[];
  readonly lockedDirection?: Readonly<Record<string, unknown>>;
  readonly conceptCandidates: readonly Readonly<Record<string, unknown>>[];
  readonly selectedConcept?: Readonly<Record<string, unknown>>;
  readonly conceptGeneration?: Readonly<Record<string, unknown>>;
  readonly generatedVisuals: readonly GeneratedVisualProvenance[];
  readonly selectedVisual?: GeneratedVisualProvenance;
  readonly demoVisuals: readonly DemoVisualRecord[];
  readonly cmfDecision?: Readonly<Record<string, unknown>>;
  readonly reviewResults: readonly Readonly<Record<string, unknown>>[];
  readonly versionEvents: readonly Readonly<Record<string, unknown>>[];
  readonly decisions: readonly Readonly<Record<string, unknown>>[];
  readonly userLockedFields: readonly string[];
  readonly contentOrigin?: ContentOrigin;
}
