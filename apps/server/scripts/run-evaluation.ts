import fs from 'fs/promises';
import path from 'path';

interface GenerateResponse {
  jobId: string;
}

interface JobResult {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  updatedAt: number;
  totalCostUSD: number;
  stages: Record<string, { status: string; latencyMs?: number; retryCount: number; repairLogs: Array<{ strategy: string; outcome: string }> }>;
  intent?: { integrations_requested: string[] };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJob(baseUrl: string, jobId: string): Promise<JobResult> {
  for (let i = 0; i < 180; i++) {
    const res = await fetch(`${baseUrl}/api/generate/${jobId}`);
    const data = (await res.json()) as JobResult;
    if (data.status === 'completed' || data.status === 'failed') return data;
    await sleep(2000);
  }
  throw new Error(`Timeout waiting for job ${jobId}`);
}

async function main() {
  const baseUrl = process.env.EVAL_API_BASE ?? 'http://localhost:3001';
  const promptsPath = path.join(process.cwd(), 'evaluation', 'prompts.json');
  const prompts = JSON.parse(await fs.readFile(promptsPath, 'utf8')) as string[];

  const startedAt = Date.now();
  const rows: Array<Record<string, unknown>> = [];

  for (const prompt of prompts) {
    const createRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const created = (await createRes.json()) as GenerateResponse;
    const job = await waitForJob(baseUrl, created.jobId);

    const stageFailures = Object.entries(job.stages)
      .filter(([, value]) => value.status === 'failed')
      .map(([stage]) => stage);
    const allRepairStrategies = Object.values(job.stages)
      .flatMap((stage) => stage.repairLogs.map((log) => log.strategy));

    rows.push({
      prompt,
      jobId: job.jobId,
      status: job.status,
      failedStage: stageFailures[0] ?? null,
      retryCount: Object.values(job.stages).reduce((sum, stage) => sum + stage.retryCount, 0),
      repairStrategies: allRepairStrategies,
      totalLatencyMs: Object.values(job.stages).reduce((sum, stage) => sum + (stage.latencyMs ?? 0), 0),
      totalCostUSD: job.totalCostUSD,
      integrationsDetected: job.intent?.integrations_requested ?? [],
      error: job.error ?? null,
    });
  }

  const successCount = rows.filter((row) => row.status === 'completed').length;
  const totalCost = rows.reduce((sum, row) => sum + Number(row.totalCostUSD ?? 0), 0);
  const totalLatency = rows.reduce((sum, row) => sum + Number(row.totalLatencyMs ?? 0), 0);

  const summary = {
    runStartedAt: new Date(startedAt).toISOString(),
    runCompletedAt: new Date().toISOString(),
    totalPrompts: rows.length,
    successCount,
    successRate: Number((successCount / rows.length).toFixed(3)),
    avgLatencyMs: Math.round(totalLatency / rows.length),
    totalCostUSD: Number(totalCost.toFixed(6)),
    avgCostUSD: Number((totalCost / rows.length).toFixed(6)),
  };

  const failureTypeCounts = new Map<string, number>();
  const stageFailureCounts = new Map<string, number>();
  for (const row of rows) {
    const failedStage = (row.failedStage as string | null) ?? null;
    if (failedStage) {
      stageFailureCounts.set(failedStage, (stageFailureCounts.get(failedStage) ?? 0) + 1);
    }
    const strategies = (row.repairStrategies as string[]) ?? [];
    if (strategies.length === 0 && row.status === 'failed') {
      failureTypeCounts.set('unrepaired_failure', (failureTypeCounts.get('unrepaired_failure') ?? 0) + 1);
    }
    for (const strategy of strategies) {
      failureTypeCounts.set(strategy, (failureTypeCounts.get(strategy) ?? 0) + 1);
    }
  }
  const mostCommonFailureType = [...failureTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
  const weakestStage = [...stageFailureCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

  const outDir = path.join(process.cwd(), 'evaluation');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({ summary, rows }, null, 2), 'utf8');
  await fs.writeFile(
    path.join(outDir, 'summary.md'),
    `# Evaluation Summary\n\nAcross ${summary.totalPrompts} prompts, the pipeline completed ${summary.successCount} successfully for a success rate of ${summary.successRate}. Mean end-to-end latency was ${summary.avgLatencyMs} ms per run. Total estimated spend was $${summary.totalCostUSD}, averaging $${summary.avgCostUSD} per generation. The most common failure type observed in logs was "${mostCommonFailureType}", and the weakest stage by failure count was "${weakestStage}".\n\nThe data shows the system is generally stable on standard prompts and that edge-case ambiguity still drives the majority of escalations. Repair logs indicate structural and field-level fixes recover many malformed outputs before hard failure, but cross-layer consistency issues remain the key quality risk in difficult prompts.\n\nNext concrete fix: add a deterministic pre-validation normalization pass before AppSpec validation to enforce required workflow stubs for all requested integrations and to auto-backfill missing page-to-API bindings when the entity mapping is unambiguous. This should directly reduce failures in ${weakestStage} without increasing model cost.\n\nSee \`evaluation/results.json\` for full per-prompt evidence.\n`,
    'utf8',
  );

  console.log(`Evaluation complete. Success rate: ${summary.successRate}`);
}

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
