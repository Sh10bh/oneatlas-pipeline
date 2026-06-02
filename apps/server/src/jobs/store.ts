import { v4 as uuidv4 } from 'uuid';
import type { JobState, StageName, StageStatus, StageCost } from '../types/JobState';
import type { RepairLog } from '../types/RepairLog';
import type { AppIntent } from '../types/AppIntent';
import type { DataSchema } from '../types/DataSchema';
import type { AppSpec } from '../types/AppSpec';

const jobs = new Map<string, JobState>();

// SSE subscriber map: jobId -> list of res.write functions
const subscribers = new Map<string, Array<(data: string) => void>>();

function makeInitialStageResult(stage: StageName) {
  return {
    stage,
    status: 'pending' as StageStatus,
    repairLogs: [],
    retryCount: 0,
  };
}

export function createJob(prompt: string): JobState {
  const jobId = uuidv4();
  const now = Date.now();
  const job: JobState = {
    jobId,
    prompt,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    stages: {
      intent_extraction: makeInitialStageResult('intent_extraction'),
      schema_generation: makeInitialStageResult('schema_generation'),
      appspec_generation: makeInitialStageResult('appspec_generation'),
    },
    totalCostUSD: 0,
  };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

export function updateStageStatus(
  jobId: string,
  stage: StageName,
  status: StageStatus,
  extra?: Partial<{
    cost: StageCost;
    retryCount: number;
    partialOutput: unknown;
    error: string;
    repairLogsCount: number;
  }>,
): void {
  const job = jobs.get(jobId);
  if (!job) return;

  const stageResult = job.stages[stage];
  stageResult.status = status;

  if (status === 'running') stageResult.startedAt = Date.now();
  if (status === 'completed' || status === 'failed') {
    stageResult.completedAt = Date.now();
    stageResult.latencyMs = stageResult.startedAt
      ? stageResult.completedAt - stageResult.startedAt
      : undefined;
  }
  if (extra?.cost) {
    stageResult.cost = extra.cost;
    job.totalCostUSD += extra.cost.estimatedUSD;
  }
  if (extra?.retryCount !== undefined) stageResult.retryCount = extra.retryCount;

  job.updatedAt = Date.now();
  emit(jobId, status === 'running' ? 'stage_start' : status === 'completed' ? 'stage_complete' : 'stage_failed', {
    stage,
    status,
    latencyMs: stageResult.latencyMs,
    cost: stageResult.cost,
    partialOutput: extra?.partialOutput,
    error: extra?.error,
    repairLogsCount: extra?.repairLogsCount ?? stageResult.repairLogs.length,
  });
}

export function addRepairLog(jobId: string, stage: StageName, log: RepairLog): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.stages[stage].repairLogs.push(log);
  job.updatedAt = Date.now();
  emit(jobId, 'repair_log', { stage, log });
}

export function setJobIntent(jobId: string, intent: AppIntent): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.intent = intent;
  job.updatedAt = Date.now();
}

export function setJobSchema(jobId: string, schema: DataSchema): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.schema = schema;
  job.updatedAt = Date.now();
}

export function setJobAppSpec(jobId: string, appSpec: AppSpec): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.appSpec = appSpec;
  job.updatedAt = Date.now();
}

export function setJobComplete(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'completed';
  job.updatedAt = Date.now();
  emit(jobId, 'generation_complete', { jobId });
}

export function setJobFailed(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'failed';
  job.error = error;
  job.updatedAt = Date.now();
  emit(jobId, 'generation_complete', { jobId, error });
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

export function subscribe(jobId: string, writer: (data: string) => void): void {
  if (!subscribers.has(jobId)) subscribers.set(jobId, []);
  subscribers.get(jobId)!.push(writer);
}

export function unsubscribe(jobId: string, writer: (data: string) => void): void {
  const subs = subscribers.get(jobId);
  if (!subs) return;
  const idx = subs.indexOf(writer);
  if (idx !== -1) subs.splice(idx, 1);
}

export function emit(jobId: string, event: string, data: unknown): void {
  const subs = subscribers.get(jobId);
  if (!subs || subs.length === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const writer of subs) {
    try { writer(payload); } catch { /* client disconnected */ }
  }
}

export function getEventHistory(jobId: string): string {
  // Replay current state as events for reconnecting clients
  const job = jobs.get(jobId);
  if (!job) return '';
  let history = '';
  for (const stage of Object.values(job.stages)) {
    if (stage.status !== 'pending') {
      history += `event: stage_${stage.status === 'running' ? 'start' : stage.status === 'completed' ? 'complete' : 'failed'}\ndata: ${JSON.stringify({ stage: stage.stage, status: stage.status, latencyMs: stage.latencyMs })}\n\n`;
      if (stage.repairLogs.length > 0) {
        history += `event: repair_log\ndata: ${JSON.stringify({ stage: stage.stage, logs: stage.repairLogs })}\n\n`;
      }
    }
  }
  if (job.status === 'completed' || job.status === 'failed') {
    history += `event: generation_complete\ndata: ${JSON.stringify({ jobId: job.jobId, error: job.error })}\n\n`;
  }
  return history;
}