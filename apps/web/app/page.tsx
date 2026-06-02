'use client';

import { useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

type StageName = 'intent_extraction' | 'schema_generation' | 'appspec_generation';

interface StageState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  latencyMs?: number;
  provider?: string;
  model?: string;
  estimatedUSD?: number;
  error?: string;
}

interface JobResponse {
  jobId: string;
  status: string;
  error?: string;
  intent?: { appName: string; appType: string; features: string[]; assumptions?: string[] };
  schema?: {
    entities: Array<{ name: string; tableName?: string; fields: Array<{ name: string; type: string }> }>;
  };
  appSpec?: {
    pages: Array<{ name: string; route: string; boundEntity: string }>;
    apiEndpoints: Array<{ method: string; path: string; boundEntity: string }>;
    integrationHooks: Array<{ integrationId: string; actionId: string; triggerEntity: string }>;
    workflowStubs: Array<{ name: string; integration: string }>;
  };
  stages: Record<StageName, { repairLogs: Array<{ details: string; outcome: string; strategy?: string }> }>;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [integrations, setIntegrations] = useState<Array<{ id: string; displayName: string; stubbed: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [stages, setStages] = useState<Record<StageName, StageState>>({
    intent_extraction: { status: 'pending' },
    schema_generation: { status: 'pending' },
    appspec_generation: { status: 'pending' },
  });

  function stageLabel(stage: StageName): string {
    if (stage === 'intent_extraction') return 'Intent Extraction';
    if (stage === 'schema_generation') return 'Schema Generation';
    return 'AppSpec Generation';
  }

  function statusClass(status: StageState['status']): string {
    if (status === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'running') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  }

  async function refreshIntegrations() {
    const res = await fetch(`${API_BASE}/api/integrations`);
    if (!res.ok) return;
    setIntegrations(await res.json());
  }

  async function refreshJob(currentJobId: string) {
    const res = await fetch(`${API_BASE}/api/generate/${currentJobId}`);
    if (!res.ok) return;
    setJob(await res.json());
  }

  async function startGeneration() {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setStatusMessage('Submitting prompt...');
    setJob(null);
    setStages({
      intent_extraction: { status: 'pending' },
      schema_generation: { status: 'pending' },
      appspec_generation: { status: 'pending' },
    });

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      const newJobId = data.jobId as string;
      setJobId(newJobId);
      setStatusMessage(`Job ${newJobId} started`);

      const es = new EventSource(`${API_BASE}/api/generate/${newJobId}/stream`);
      es.addEventListener('stage_start', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [data.stage]: { ...prev[data.stage], status: 'running' },
        }));
      });
      es.addEventListener('stage_complete', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [data.stage]: {
            status: 'completed',
            latencyMs: data.latencyMs,
            provider: data.cost?.provider,
            model: data.cost?.model,
            estimatedUSD: data.cost?.estimatedUSD,
          },
        }));
      });
      es.addEventListener('stage_failed', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [data.stage]: { ...prev[data.stage], status: 'failed', error: data.error },
        }));
      });
      es.addEventListener('generation_complete', async () => {
        await refreshJob(newJobId);
        setStatusMessage('Generation complete');
        setIsLoading(false);
        es.close();
      });
    } catch (error) {
      setStatusMessage(`Failed to start generation: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
    }
  }

  const repairLogs = useMemo(
    () =>
      job
        ? (Object.values(job.stages).flatMap((stage) => stage.repairLogs ?? []))
        : [],
    [job],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OneAtlas Pipeline Console</h1>
            <p className="text-sm text-slate-600">Generate, validate, repair, and inspect AppSpec outputs.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
            <div className="font-medium text-slate-700">Current Job</div>
            <div className="font-mono text-xs text-slate-500">{jobId ?? 'No active job'}</div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-base font-semibold text-slate-900">Describe Your App</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-36 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none ring-blue-200 placeholder:text-slate-400 focus:ring-2"
                placeholder="e.g. Build a CRM for a real estate agency with WhatsApp notifications..."
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={startGeneration}
                className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Generating...' : 'Generate AppSpec'}
              </button>
              <p className="mt-2 text-xs text-slate-500">{statusMessage || 'Ready to run pipeline.'}</p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Pipeline Stages</h2>
                <span className="text-xs text-slate-500">Live via SSE</span>
              </div>
              <div className="space-y-3">
                {(['intent_extraction', 'schema_generation', 'appspec_generation'] as const).map((stage) => (
                  <div key={stage} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">{stageLabel(stage)}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(stages[stage].status)}`}>
                        {stages[stage].status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      {stages[stage].latencyMs !== undefined && <p>Latency: {stages[stage].latencyMs} ms</p>}
                      {stages[stage].provider && <p>Model: {stages[stage].provider}/{stages[stage].model}</p>}
                      {stages[stage].estimatedUSD !== undefined && <p>Cost: ${stages[stage].estimatedUSD.toFixed(6)}</p>}
                      {stages[stage].error && <p className="text-red-600">{stages[stage].error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Integrations</h2>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  onClick={refreshIntegrations}
                >
                  Refresh
                </button>
              </div>
              {integrations.length === 0 && <p className="text-xs text-slate-500">No integrations loaded yet.</p>}
              <div className="space-y-2 text-sm">
                {integrations.map((integration) => (
                  <div key={integration.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-slate-800">{integration.displayName}</p>
                      <p className="text-xs text-slate-500">{integration.id}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      integration.stubbed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                    >
                      {integration.stubbed ? 'stubbed' : 'implemented'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            {job?.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                <p className="font-medium">Generation failed</p>
                <p>{job.error}</p>
              </div>
            )}

            {job?.intent && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Intent Summary</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">App Name</p>
                    <p className="font-medium text-slate-800">{job.intent.appName}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">App Type</p>
                    <p className="font-medium text-slate-800">{job.intent.appType}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="mb-1 text-xs text-slate-500">Features</p>
                  <div className="flex flex-wrap gap-2">
                    {job.intent.features.map((feature) => (
                      <span key={feature} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {job?.schema && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Data Schema</h2>
                <div className="space-y-3">
                  {job.schema.entities.map((entity) => (
                    <div key={entity.name} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-800">
                        {entity.name}
                        {entity.tableName ? <span className="ml-2 text-xs font-normal text-slate-500">({entity.tableName})</span> : null}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entity.fields.map((field) => (
                          <span key={`${entity.name}-${field.name}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                            {field.name}:{field.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {job?.appSpec && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Generated AppSpec</h2>
                <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Page</th>
                        <th className="px-3 py-2">Route</th>
                        <th className="px-3 py-2">Bound Entity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.appSpec.pages.map((page) => (
                        <tr key={`${page.name}-${page.route}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">{page.name}</td>
                          <td className="px-3 py-2">{page.route}</td>
                          <td className="px-3 py-2">{page.boundEntity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Path</th>
                        <th className="px-3 py-2">Bound Entity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.appSpec.apiEndpoints.map((ep) => (
                        <tr key={`${ep.method}-${ep.path}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">{ep.method}</td>
                          <td className="px-3 py-2">{ep.path}</td>
                          <td className="px-3 py-2">{ep.boundEntity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Integration Hooks</h3>
                    <div className="space-y-1 text-sm text-slate-700">
                      {job.appSpec.integrationHooks?.length ? job.appSpec.integrationHooks.map((hook) => (
                        <p key={`${hook.integrationId}-${hook.actionId}-${hook.triggerEntity}`}>
                          {hook.integrationId} → {hook.actionId} ({hook.triggerEntity})
                        </p>
                      )) : <p className="text-slate-500">No integration hooks produced.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Workflow Stubs</h3>
                    <div className="space-y-1 text-sm text-slate-700">
                      {job.appSpec.workflowStubs.length ? job.appSpec.workflowStubs.map((wf) => (
                        <p key={wf.name}>{wf.name} — {wf.integration}</p>
                      )) : <p className="text-slate-500">No workflow stubs produced.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Error & Repair Panel</h2>
              {Object.entries(stages).some(([, stage]) => stage.error) && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {Object.entries(stages)
                    .filter(([, stage]) => Boolean(stage.error))
                    .map(([name, stage]) => `${stageLabel(name as StageName)}: ${stage.error}`)
                    .join(' | ')}
                </div>
              )}
              {repairLogs.length === 0 && <p className="text-sm text-slate-500">No repairs attempted yet.</p>}
              <div className="space-y-2">
                {repairLogs.map((log, idx) => (
                  <div key={`${log.details}-${idx}`} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p><span className="font-medium text-slate-700">Outcome:</span> {log.outcome}</p>
                    <p><span className="font-medium text-slate-700">Strategy:</span> {log.strategy ?? 'unknown'}</p>
                    <p className="text-slate-600">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
