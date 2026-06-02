import type { AppIntent } from './AppIntent';
import type { DataSchema } from './DataSchema';
import type { AppSpec } from './AppSpec';
import type { RepairLog } from './RepairLog';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type StageName =
  | 'intent_extraction'
  | 'schema_generation'
  | 'appspec_generation';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StageCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUSD: number;
  provider: string;
  model: string;
}

export interface StageResult {
  stage: StageName;
  status: StageStatus;
  startedAt?: number;
  completedAt?: number;
  latencyMs?: number;
  cost?: StageCost;
  repairLogs: RepairLog[];
  retryCount: number;
}

export interface JobState {
  jobId: string;
  prompt: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  stages: Record<StageName, StageResult>;
  intent?: AppIntent;
  schema?: DataSchema;
  appSpec?: AppSpec;
  totalCostUSD: number;
  error?: string;
}