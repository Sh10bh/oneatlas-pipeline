import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import './integrations/index'; // registers all integrations

import {
  createJob, getJob, updateStageStatus, addRepairLog,
  setJobIntent, setJobSchema, setJobAppSpec,
  setJobComplete, setJobFailed, subscribe, unsubscribe, getEventHistory,
} from './jobs/store';
import { extractIntent } from './pipeline/intent';
import { generateSchema } from './pipeline/schema';
import { generateAppSpec } from './pipeline/appspec';
import { integrationRegistry } from './integrations/registry';
import { fieldRepair, consistencyRepair } from './repair/strategies';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── POST /api/generate ───────────────────────────────────────────────────────

app.post('/api/generate', (req, res) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const job = createJob(prompt.trim());

  // Run pipeline async
  runPipeline(job.jobId).catch((err) => {
    console.error(`[pipeline] Job ${job.jobId} crashed:`, err);
    setJobFailed(job.jobId, err instanceof Error ? err.message : String(err));
  });

  res.json({ jobId: job.jobId });
});

// ─── GET /api/generate/:jobId/stream ─────────────────────────────────────────

app.get('/api/generate/:jobId/stream', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Replay prior events for reconnecting clients
  const history = getEventHistory(jobId);
  if (history) res.write(history);

  const writer = (data: string) => res.write(data);
  subscribe(jobId, writer);

  req.on('close', () => {
    unsubscribe(jobId, writer);
  });
});

// ─── GET /api/generate/:jobId ─────────────────────────────────────────────────

app.get('/api/generate/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
  res.json(job);
});

// ─── POST /api/generate/:jobId/repair ────────────────────────────────────────

app.post('/api/generate/:jobId/repair', async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

  const { stage, errorHint } = req.body as { stage?: string; errorHint?: string };
  if (!stage) { res.status(400).json({ error: 'stage is required' }); return; }

  const errors = [{ field: 'manual', message: errorHint ?? 'Manual repair triggered', code: 'manual' }];

  if (stage === 'intent_extraction' && job.intent) {
    const repair = fieldRepair(job.intent as unknown as Record<string, unknown>, errors, 'intent_extraction');
    res.json({ repair: repair.log, data: repair.data });
    return;
  }

  if (stage === 'schema_generation' && job.schema) {
    const repair = consistencyRepair(
      job.schema as unknown as Record<string, unknown>, errors, 'schema_generation'
    );
    res.json({ repair: repair.log, data: repair.data });
    return;
  }

  if (stage === 'appspec_generation' && job.appSpec) {
    const knownEntities = job.schema?.entities.map(e => e.name) ?? [];
    const repair = consistencyRepair(
      job.appSpec as unknown as Record<string, unknown>, errors, 'appspec_generation', knownEntities
    );
    res.json({ repair: repair.log, data: repair.data });
    return;
  }

  res.status(400).json({ error: `Cannot repair stage "${stage}" — no output found` });
});

// ─── GET /api/integrations ────────────────────────────────────────────────────

app.get('/api/integrations', (_req, res) => {
  res.json(integrationRegistry.getAll());
});

// ─── Pipeline runner ──────────────────────────────────────────────────────────

async function runPipeline(jobId: string): Promise<void> {
  const job = getJob(jobId)!;
  job.status = 'running';

  // Stage 1: Intent Extraction
  updateStageStatus(jobId, 'intent_extraction', 'running');
  try {
    const result = await extractIntent(job.prompt);
    setJobIntent(jobId, result.intent);
    for (const log of result.repairLogs) addRepairLog(jobId, 'intent_extraction', log);
    updateStageStatus(jobId, 'intent_extraction', 'completed', {
      cost: result.cost,
      retryCount: result.retryCount,
      partialOutput: result.intent,
      repairLogsCount: result.repairLogs.length,
    });

    // If clarification required, stop here
    if (result.intent.clarification_required) {
      setJobComplete(jobId);
      return;
    }
  } catch (err) {
    updateStageStatus(jobId, 'intent_extraction', 'failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // Stage 2: Schema Generation
  updateStageStatus(jobId, 'schema_generation', 'running');
  const intent = getJob(jobId)!.intent!;
  try {
    const result = await generateSchema(intent);
    setJobSchema(jobId, result.schema);
    for (const log of result.repairLogs) addRepairLog(jobId, 'schema_generation', log);
    updateStageStatus(jobId, 'schema_generation', 'completed', {
      cost: result.cost,
      retryCount: result.retryCount,
      partialOutput: result.schema,
      repairLogsCount: result.repairLogs.length,
    });
  } catch (err) {
    updateStageStatus(jobId, 'schema_generation', 'failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // Stage 3: AppSpec Generation
  updateStageStatus(jobId, 'appspec_generation', 'running');
  const schema = getJob(jobId)!.schema!;
  try {
    const result = await generateAppSpec(intent, schema);
    setJobAppSpec(jobId, result.appSpec);
    for (const log of result.repairLogs) addRepairLog(jobId, 'appspec_generation', log);
    updateStageStatus(jobId, 'appspec_generation', 'completed', {
      cost: result.cost,
      retryCount: result.retryCount,
      partialOutput: result.appSpec,
      repairLogsCount: result.repairLogs.length,
    });
  } catch (err) {
    updateStageStatus(jobId, 'appspec_generation', 'failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  setJobComplete(jobId);
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`[server] OneAtlas pipeline running on port ${PORT}`);
});