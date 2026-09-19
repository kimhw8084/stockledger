import { contentHash } from "../domain/contentHash";
import { CALENDAR_VERSION } from "../lib/marketCalendar";
import { MARKET_DATA_INGESTION_CONTRACT_REVISION, MARKET_DATA_INGESTION_CONTRACT_VERSION, MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION, MARKET_DATA_RIGHTS_CONTRACT_REVISION, MARKET_DATA_RIGHTS_CONTRACT_VERSION } from "../lib/marketDataContract";
import { FINANCIAL_TRUTH_ENGINE_VERSION, PRODUCTION_METRIC_CONTRACT_VERSION } from "../lib/metricCatalog";
import { NOTIFICATION_DELIVERY_CONTRACT_REVISION, NOTIFICATION_DELIVERY_CONTRACT_VERSION, NOTIFICATION_DIGEST_CONTRACT_REVISION, NOTIFICATION_DIGEST_CONTRACT_VERSION } from "../domain/notificationDelivery";
import { NOTIFICATION_PREFERENCES_CONTRACT_VERSION } from "../domain/notificationPreferences";
import { syncContractVersion } from "../features/sync/syncPlan";
import { WORKER_JOB_CONTRACT_REVISION, WORKER_JOB_CONTRACT_VERSION, WORKER_DATABASE_SCHEMA_VERSION } from "./releaseContracts";

export const RELEASE_EVIDENCE_CONTRACT_VERSION = "stockledger-release-evidence-v1" as const;
export const RELEASE_EVIDENCE_CONTRACT_REVISION = 1 as const;

export interface ReleaseMigrationIdentity { path: string; sha256: string; order: number }
export interface ReleaseArtifactIdentity { path: string; sha256: string; bytes: number }
export interface ReleaseEvidence {
  contractVersion: typeof RELEASE_EVIDENCE_CONTRACT_VERSION;
  revision: typeof RELEASE_EVIDENCE_CONTRACT_REVISION;
  evidenceHash: string;
  baseCommit: string;
  source: { commit: string; tree: string; workingTree: "clean" };
  versions: {
    app: string;
    nodeRequirement: string;
    nodeRuntime: string;
    workspaceExportSchema: number;
    workerDatabaseSchema: number;
    financialTruthEngine: string;
    financialTruthContract: string;
    calendar: string;
    workerJobContract: { version: string; revision: number };
    notification: { delivery: string; deliveryRevision: number; digest: string; digestRevision: number; preferences: string };
    ingestion: { version: string; revision: number };
    rights: { version: string; revision: number; authorityModel: string };
    sync: string;
  };
  migrations: { ordered: true; files: ReleaseMigrationIdentity[] };
  packageLock: { sha256: string };
  artifacts: { generated: boolean; files: ReleaseArtifactIdentity[] };
  verification: { commands: string[]; checks: string[] };
  externalGates: string[];
  rollback: {
    policy: "additive-forward-only";
    safeRollback: string[];
    forwardMigrationRequired: string[];
    incompatibleAssertions: string[];
  };
}

export interface ReleaseEvidenceInput {
  appVersion: string;
  nodeRequirement: string;
  nodeRuntime: string;
  baseCommit: string;
  sourceCommit: string;
  sourceTree: string;
  migrations: ReleaseMigrationIdentity[];
  packageLockSha256: string;
  artifacts?: ReleaseArtifactIdentity[];
}

export interface ReleaseVerificationFacts {
  appVersion: string;
  nodeRequirement: string;
  baseCommit: string;
  sourceCommit: string;
  sourceTree: string;
  migrations: ReleaseMigrationIdentity[];
  packageLockSha256: string;
  artifacts?: ReleaseArtifactIdentity[];
}

const contractSnapshot = (input: ReleaseEvidenceInput): ReleaseEvidence["versions"] => ({
  app: input.appVersion,
  nodeRequirement: input.nodeRequirement,
  nodeRuntime: input.nodeRuntime,
  workspaceExportSchema: 2,
  workerDatabaseSchema: WORKER_DATABASE_SCHEMA_VERSION,
  financialTruthEngine: FINANCIAL_TRUTH_ENGINE_VERSION,
  financialTruthContract: PRODUCTION_METRIC_CONTRACT_VERSION,
  calendar: CALENDAR_VERSION,
  workerJobContract: { version: WORKER_JOB_CONTRACT_VERSION, revision: WORKER_JOB_CONTRACT_REVISION },
  notification: { delivery: NOTIFICATION_DELIVERY_CONTRACT_VERSION, deliveryRevision: NOTIFICATION_DELIVERY_CONTRACT_REVISION, digest: NOTIFICATION_DIGEST_CONTRACT_VERSION, digestRevision: NOTIFICATION_DIGEST_CONTRACT_REVISION, preferences: NOTIFICATION_PREFERENCES_CONTRACT_VERSION },
  ingestion: { version: MARKET_DATA_INGESTION_CONTRACT_VERSION, revision: MARKET_DATA_INGESTION_CONTRACT_REVISION },
  rights: { version: MARKET_DATA_RIGHTS_CONTRACT_VERSION, revision: MARKET_DATA_RIGHTS_CONTRACT_REVISION, authorityModel: MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION },
  sync: syncContractVersion,
});

const normalizedMigrations = (files: ReleaseMigrationIdentity[]) => [...files].sort((left, right) => left.order - right.order || left.path.localeCompare(right.path)).map((file, index) => ({ ...file, order: index }));
const evidencePayload = (evidence: Omit<ReleaseEvidence, "evidenceHash">) => evidence;

export function buildReleaseEvidence(input: ReleaseEvidenceInput): ReleaseEvidence {
  const migrations = normalizedMigrations(input.migrations);
  const payload: Omit<ReleaseEvidence, "evidenceHash"> = {
    contractVersion: RELEASE_EVIDENCE_CONTRACT_VERSION,
    revision: RELEASE_EVIDENCE_CONTRACT_REVISION,
    baseCommit: input.baseCommit,
    source: { commit: input.sourceCommit, tree: input.sourceTree, workingTree: "clean" },
    versions: contractSnapshot(input),
    migrations: { ordered: true, files: migrations },
    packageLock: { sha256: input.packageLockSha256 },
    artifacts: { generated: Boolean(input.artifacts?.length), files: [...(input.artifacts ?? [])].sort((left, right) => left.path.localeCompare(right.path)) },
    verification: {
      commands: ["npm ci", "npm run typecheck", "npm test -- --run", "npm run check:boundaries", "npm run check:frozen", "npm run export:all", "npm run test:e2e", "npm audit --audit-level=high", "npm run test:cloud"],
      checks: ["source-tree-match", "migration-order-and-digest-match", "contract-snapshot-match", "package-lock-match", "artifact-digest-match-when-present", "rollback-compatibility"],
    },
    externalGates: ["hosted-scheduler", "hosted-notification-transport", "commercial-market-data-agreement", "billing-lifecycle", "production-cloud-backup", "external-incident-pager", "native-device-certification", "real-user-load"],
    rollback: {
      policy: "additive-forward-only",
      safeRollback: ["static-artifact-to-a-verified-compatible-build", "same-schema-export-restore-to-a-new-sqlite-path"],
      forwardMigrationRequired: ["worker-database-schema", "cloud-migrations", "workspace-export-schema"],
      incompatibleAssertions: ["no-destructive-database-downgrade", "no-rollback-across-unsupported-schema", "no-rollback-from-changed-financial-truth-contract"],
    },
  };
  return { ...payload, evidenceHash: contentHash(evidencePayload(payload)) };
}

const isHexIdentity = (value: unknown) => typeof value === "string" && /^[a-f0-9]{40,64}$/i.test(value);
const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function verifyReleaseEvidence(evidence: unknown, facts: ReleaseVerificationFacts): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!evidence || typeof evidence !== "object") return { ok: false, reasons: ["malformed-manifest"] };
  const candidate = evidence as Partial<ReleaseEvidence>;
  if (candidate.contractVersion !== RELEASE_EVIDENCE_CONTRACT_VERSION || candidate.revision !== RELEASE_EVIDENCE_CONTRACT_REVISION) reasons.push("unsupported-contract");
  if (!isHexIdentity(candidate.baseCommit) || !isHexIdentity(candidate.source?.commit) || !isHexIdentity(candidate.source?.tree)) reasons.push("malformed-source-identity");
  if (candidate.source?.workingTree !== "clean") reasons.push("dirty-source-identity");
  if (typeof candidate.evidenceHash !== "string") reasons.push("missing-evidence-hash");
  else {
    const { evidenceHash: _ignored, ...withoutHash } = candidate as ReleaseEvidence;
    if (candidate.evidenceHash !== contentHash(evidencePayload(withoutHash))) reasons.push("evidence-hash-mismatch");
  }
  if (candidate.source?.commit !== facts.sourceCommit || candidate.source?.tree !== facts.sourceTree) reasons.push("stale-or-mismatched-source-tree");
  if (candidate.baseCommit !== facts.baseCommit) reasons.push("protected-base-mismatch");
  if (!candidate.migrations?.ordered || !Array.isArray(candidate.migrations.files)) reasons.push("malformed-migration-manifest");
  else if (!sameJson(candidate.migrations.files, normalizedMigrations(facts.migrations))) reasons.push("migration-order-or-digest-mismatch");
  if (candidate.packageLock?.sha256 !== facts.packageLockSha256) reasons.push("package-lock-mismatch");
  if (candidate.versions?.app !== facts.appVersion || candidate.versions?.nodeRequirement !== facts.nodeRequirement) reasons.push("runtime-version-mismatch");
  if (!candidate.versions || candidate.versions.workerDatabaseSchema !== WORKER_DATABASE_SCHEMA_VERSION || candidate.versions.workspaceExportSchema !== 2) reasons.push("schema-mismatch");
  if (!candidate.versions || candidate.versions.financialTruthEngine !== FINANCIAL_TRUTH_ENGINE_VERSION || candidate.versions.financialTruthContract !== PRODUCTION_METRIC_CONTRACT_VERSION || candidate.versions.calendar !== CALENDAR_VERSION) reasons.push("financial-contract-mismatch");
  if (!candidate.versions || candidate.versions.workerJobContract?.version !== WORKER_JOB_CONTRACT_VERSION || candidate.versions.workerJobContract?.revision !== WORKER_JOB_CONTRACT_REVISION || candidate.versions.ingestion?.version !== MARKET_DATA_INGESTION_CONTRACT_VERSION || candidate.versions.rights?.version !== MARKET_DATA_RIGHTS_CONTRACT_VERSION || candidate.versions.sync !== syncContractVersion) reasons.push("contract-snapshot-mismatch");
  if (!candidate.rollback || candidate.rollback.policy !== "additive-forward-only" || candidate.rollback.incompatibleAssertions?.some(assertion => !assertion.startsWith("no-"))) reasons.push("incompatible-rollback-assertion");
  const actualArtifacts = [...(facts.artifacts ?? [])].sort((left, right) => left.path.localeCompare(right.path));
  if (!candidate.artifacts || !Array.isArray(candidate.artifacts.files) || !sameJson(candidate.artifacts.files, actualArtifacts)) reasons.push("artifact-digest-mismatch");
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)].sort() };
}
