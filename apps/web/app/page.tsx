'use client';

import { useEffect, useMemo, useState } from 'react';

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
  totalCostUSD?: number;
  intent?: {
    appName: string;
    appType: string;
    features: string[];
    assumptions?: string[];
    integrations_requested?: string[];
    clarification_required?: { flag: true; question: string };
  };
  schema?: {
    entities: Array<{ name: string; tableName?: string; fields: Array<{ name: string; type: string }> }>;
  };
  appSpec?: {
    pages: Array<{ name: string; route: string; layout: string; boundEntity: string }>;
    apiEndpoints: Array<{ method: string; path: string; boundEntity: string; authRequired: boolean; rateLimitFlag: boolean }>;
    authRules: Array<{ role: string; permissions: Array<{ entity: string; actions: string[] }> }>;
    integrationHooks: Array<{ integrationId: string; actionId: string; triggerEntity: string; triggerEvent: string; description: string }>;
    workflowStubs: Array<{ name: string; integration: string; action: string; trigger: { entity: string; event: string; condition?: string }; payload: Record<string, string> }>;
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
    const data = (await res.json()) as Array<{ id: string; displayName: string; implemented?: boolean; stubbed?: boolean }>;
    setIntegrations(
      data.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        stubbed: item.stubbed ?? !item.implemented,
      })),
    );
  }

  useEffect(() => {
    void refreshIntegrations();
  }, []);

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
        const d = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [d.stage]: { ...prev[d.stage], status: 'running' },
        }));
      });
      es.addEventListener('stage_complete', (event) => {
        const d = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [d.stage]: {
            status: 'completed',
            latencyMs: d.latencyMs,
            provider: d.cost?.provider,
            model: d.cost?.model,
            estimatedUSD: d.cost?.estimatedUSD,
          },
        }));
      });
      es.addEventListener('stage_failed', (event) => {
        const d = JSON.parse((event as MessageEvent).data);
        setStages((prev) => ({
          ...prev,
          [d.stage]: { ...prev[d.stage], status: 'failed', error: d.error },
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
    () => (job ? Object.values(job.stages).flatMap((stage) => stage.repairLogs ?? []) : []),
    [job],
  );

  const totalCost = job?.totalCostUSD ?? Object.values(stages).reduce((sum, s) => sum + (s.estimatedUSD ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OneAtlas Pipeline Console</h1>
            <p className="text-sm text-slate-600">Generate, validate, repair, and inspect AppSpec outputs.</p>
          </div>
          <div className="flex gap-3">
            {totalCost > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
                <div className="text-xs text-slate-500">Total Cost</div>
                <div className="font-mono font-medium text-slate-800">${totalCost.toFixed(6)}</div>
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
              <div className="font-medium text-slate-700">Current Job</div>
              <div className="font-mono text-xs text-slate-500">{jobId ?? 'No active job'}</div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="space-y-6">
            {/* Prompt input */}
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

            {/* Pipeline stages */}
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

            {/* Integration panel */}
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
                    }`}>
                      {integration.stubbed ? 'stubbed' : 'implemented'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            {/* Generation error */}
            {job?.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
                <p className="font-medium">Generation failed</p>
                <p>{job.error}</p>
              </div>
            )}

            {/* Clarification required */}
            {job?.intent?.clarification_required && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
                <p className="font-medium">Clarification Required</p>
                <p className="mt-1">{job.intent.clarification_required.question}</p>
              </div>
            )}

            {/* Intent summary */}
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
                {job.intent.integrations_requested && job.intent.integrations_requested.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Integrations Requested</p>
                    <div className="flex flex-wrap gap-2">
                      {job.intent.integrations_requested.map((integration) => (
                        <span key={integration} className="rounded-full bg-purple-50 px-2 py-1 text-xs text-purple-700">
                          {integration}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.intent.assumptions && job.intent.assumptions.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs text-slate-500">Assumptions</p>
                    <ul className="space-y-1">
                      {job.intent.assumptions.map((assumption, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-slate-700">
                          <span className="mt-0.5 text-slate-400">•</span>
                          <span>{assumption}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Data schema */}
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

            {/* AppSpec */}
            {job?.appSpec && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Generated AppSpec</h2>

                {/* Pages table */}
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Pages</h3>
                <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Page</th>
                        <th className="px-3 py-2">Route</th>
                        <th className="px-3 py-2">Layout</th>
                        <th className="px-3 py-2">Bound Entity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.appSpec.pages.map((page) => (
                        <tr key={`${page.name}-${page.route}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">{page.name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{page.route}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{page.layout}</span>
                          </td>
                          <td className="px-3 py-2">{page.boundEntity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* API endpoints table */}
                <h3 className="mb-2 text-sm font-semibold text-slate-700">API Endpoints</h3>
                <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Path</th>
                        <th className="px-3 py-2">Bound Entity</th>
                        <th className="px-3 py-2">Auth</th>
                        <th className="px-3 py-2">Rate Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.appSpec.apiEndpoints.map((ep) => (
                        <tr key={`${ep.method}-${ep.path}`} className="border-t border-slate-200">
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                              ep.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                              ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                              ep.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{ep.method}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{ep.path}</td>
                          <td className="px-3 py-2">{ep.boundEntity}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs ${ep.authRequired ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {ep.authRequired ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs ${ep.rateLimitFlag ? 'text-amber-600' : 'text-slate-400'}`}>
                              {ep.rateLimitFlag ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Auth rules */}
                {job.appSpec.authRules && job.appSpec.authRules.length > 0 && (
                  <>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">Auth Rules</h3>
                    <div className="mb-5 space-y-2">
                      {job.appSpec.authRules.map((rule) => (
                        <div key={rule.role} className="rounded-xl border border-slate-200 p-3">
                          <p className="mb-2 text-sm font-medium text-slate-800">
                            Role: <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">{rule.role}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {rule.permissions.map((perm) => (
                              <div key={perm.entity} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                <span className="font-medium text-slate-700">{perm.entity}</span>
                                <span className="ml-1 text-slate-500">— {perm.actions.join(', ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Integration hooks + workflow stubs */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Integration Hooks</h3>
                    <div className="space-y-2 text-sm text-slate-700">
                      {job.appSpec.integrationHooks?.length ? job.appSpec.integrationHooks.map((hook, idx) => (
                        <div key={`hook-${idx}-${hook.integrationId}-${hook.actionId}`} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                          <p className="font-medium text-slate-800">{hook.integrationId} → {hook.actionId}</p>
                          <p className="text-slate-500">{hook.triggerEntity} on {hook.triggerEvent}</p>
                          {hook.description && <p className="mt-0.5 text-slate-400">{hook.description}</p>}
                        </div>
                      )) : <p className="text-slate-500">No integration hooks produced.</p>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Workflow Stubs</h3>
                    <div className="space-y-2 text-sm text-slate-700">
                      {job.appSpec.workflowStubs.length ? job.appSpec.workflowStubs.map((wf, idx) => (
                        <div key={`wf-${idx}-${wf.name}`} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                          <p className="font-medium text-slate-800">{wf.name}</p>
                          <p className="text-slate-500">{wf.integration} → {wf.action}</p>
                          <p className="text-slate-400">{wf.trigger.entity} on {wf.trigger.event}{wf.trigger.condition ? ` (${wf.trigger.condition})` : ''}</p>
                        </div>
                      )) : <p className="text-slate-500">No workflow stubs produced.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error & repair panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Error &amp; Repair Panel</h2>
              {Object.entries(stages).some(([, stage]) => stage.error) && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {Object.entries(stages)
                    .filter(([, stage]) => Boolean(stage.error))
                    .map(([name, stage]) => `${stageLabel(name as StageName)}: ${stage.error}`)
                    .join(' | ')}
                </div>
              )}
              {repairLogs.length === 0 ? (
                <p className="text-sm text-slate-500">No repairs attempted yet.</p>
              ) : (
                <div className="space-y-2">
                  {repairLogs.map((log, idx) => (
                    <div key={`${log.details}-${idx}`} className={`rounded-xl border p-3 text-sm ${
                      log.outcome === 'repaired' ? 'border-emerald-200 bg-emerald-50' :
                      log.outcome === 'failed' ? 'border-red-200 bg-red-50' :
                      'border-amber-200 bg-amber-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.outcome === 'repaired' ? 'bg-emerald-100 text-emerald-700' :
                          log.outcome === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{log.outcome}</span>
                        <span className="text-xs text-slate-600">{log.strategy ?? 'unknown'}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{log.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}