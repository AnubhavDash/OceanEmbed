import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ArtifactRef, InsertUser, NewOceanRun, PipelineConfig, artifactRefs, oceanRunPayloads, pipelineConfigs, oceanRuns, qaTraces, thresholdAlerts, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { summarizePersistedRun } from "./persistedRun";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export const DEFAULT_PIPELINE_CONFIG_ID = "north-indian-ocean-daily";

export async function ensureNorthIndianOceanPipelineConfig(): Promise<PipelineConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(pipelineConfigs).values({
    id: DEFAULT_PIPELINE_CONFIG_ID,
    name: "North Indian Ocean daily scene refresh",
    regionName: "North Indian Ocean",
    cronExpression: "0 30 3 * * *",
    enabled: 0,
    dataSourceStatus: "unconfigured",
    modelEndpointStatus: "unconfigured",
  }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  return (await db.select().from(pipelineConfigs).where(eq(pipelineConfigs.id, DEFAULT_PIPELINE_CONFIG_ID)).limit(1))[0];
}

export async function getPipelineConfigByTaskUid(taskUid: string): Promise<PipelineConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(pipelineConfigs).where(eq(pipelineConfigs.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function getOceanRunById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(oceanRuns).where(eq(oceanRuns.id, id)).limit(1))[0];
}

export async function getLatestPersistedOceanRun() {
  const db = await getDb();
  if (!db) return undefined;
  const run = (await db.select().from(oceanRuns).where(eq(oceanRuns.status, "completed")).orderBy(desc(oceanRuns.completedAt)).limit(1))[0];
  if (!run) return undefined;
  const [artifacts, traces, payload] = await Promise.all([
    db.select().from(artifactRefs).where(eq(artifactRefs.runId, run.id)),
    db.select().from(qaTraces).where(eq(qaTraces.runId, run.id)),
    db.select().from(oceanRunPayloads).where(eq(oceanRunPayloads.runId, run.id)).limit(1),
  ]);
  return { ...summarizePersistedRun(run, artifacts, traces), payload: payload[0] ?? null };
}

export async function createOceanRunIfAbsent(run: NewOceanRun): Promise<{ created: boolean; runId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; scheduled run cannot be made durable.");
  const existing = (await db.select().from(oceanRuns).where(and(eq(oceanRuns.id, run.id), eq(oceanRuns.regionName, run.regionName))).limit(1))[0];
  if (existing) return { created: false, runId: existing.id };
  await db.insert(oceanRuns).values(run);
  return { created: true, runId: run.id };
}

export async function recordArtifactRef(input: Omit<ArtifactRef, "createdAt">): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; artifact reference cannot be made durable.");
  await db.insert(artifactRefs).values(input);
}

export async function recordThresholdAlert(input: typeof thresholdAlerts.$inferInsert): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert delivery cannot be made durable.");
  await db.insert(thresholdAlerts).values(input);
}
