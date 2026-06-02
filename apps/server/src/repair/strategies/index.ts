import { v4 as uuidv4 } from 'uuid';
import type { RepairLog, RepairStrategy, RepairOutcome } from '../types/RepairLog';
import type { StageName } from '../types/JobState';
import { gatewayCall, extractJSON } from '../gateway';
import { ROUTING_CONFIG } from '../config/model-routing';

export interface RepairResult {
  repaired: boolean;
  data: unknown;
  log: RepairLog;
}

function makeLog(
  stage: StageName,
  strategy: RepairStrategy,
  errorInput: string,
  outcome: RepairOutcome,
  details: string,
): RepairLog {
  return {
    id: uuidv4(),
    stage,
    strategy,
    errorInput,
    outcome,
    attemptedAt: Date.now(),
    details,
  };
}

// ─── Strategy 1: Structural repair ───────────────────────────────────────────
// Handles malformed/truncated JSON by extracting valid portion + filling defaults

export function structuralRepair(rawText: string, stage: StageName): RepairResult {
  const errorInput = rawText.slice(0, 200);
  try {
    const extracted = extractJSON(rawText);
    const parsed = JSON.parse(extracted);
    return {
      repaired: true,
      data: parsed,
      log: makeLog(stage, 'structural_repair', errorInput, 'repaired',
        'Extracted valid JSON from malformed/fenced response'),
    };
  } catch {
    // Try to find any partial object and return it
    const partialMatch = rawText.match(/\{[\s\S]*/);
    if (partialMatch) {
      // Attempt to close unclosed braces
      let partial = partialMatch[0];
      const opens = (partial.match(/\{/g) ?? []).length;
      const closes = (partial.match(/\}/g) ?? []).length;
      partial += '}'.repeat(Math.max(0, opens - closes));
      try {
        const parsed = JSON.parse(partial);
        return {
          repaired: true,
          data: parsed,
          log: makeLog(stage, 'structural_repair', errorInput, 'repaired',
            'Closed unclosed braces and parsed partial JSON'),
        };
      } catch { /* fall through */ }
    }
    return {
      repaired: false,
      data: null,
      log: makeLog(stage, 'structural_repair', errorInput, 'escalated',
        'Could not extract valid JSON structure — escalating to field repair or re-prompt'),
    };
  }
}

// ─── Strategy 2: Field repair ─────────────────────────────────────────────────
// Handles missing/wrongly-typed fields by filling in typed defaults

export function fieldRepair(
  data: Record<string, unknown>,
  errors: Array<{ field: string; message: string; code: string }>,
  stage: StageName,
): RepairResult {
  const errorInput = JSON.stringify(errors).slice(0, 200);
  const patched = { ...data };
  let repairedCount = 0;

  for (const err of errors) {
    const field = err.field;
    // Supply typed defaults based on field name patterns
    if (field.includes('appName') && !patched.appName) {
      patched.appName = 'GeneratedApp'; repairedCount++;
    } else if (field.includes('appType') && !patched.appType) {
      patched.appType = 'custom'; repairedCount++;
    } else if (field.includes('features') && !patched.features) {
      patched.features = ['core functionality']; repairedCount++;
    } else if (field.includes('entities') && !patched.entities) {
      patched.entities = ['User']; repairedCount++;
    } else if (field.includes('integrations_requested') && !patched.integrations_requested) {
      patched.integrations_requested = []; repairedCount++;
    } else if (field.includes('assumptions') && !patched.assumptions) {
      patched.assumptions = []; repairedCount++;
    } else if (field.includes('pages') && !patched.pages) {
      patched.pages = []; repairedCount++;
    } else if (field.includes('apiEndpoints') && !patched.apiEndpoints) {
      patched.apiEndpoints = []; repairedCount++;
    } else if (field.includes('authRules') && !patched.authRules) {
      patched.authRules = []; repairedCount++;
    } else if (field.includes('integrationHooks') && !patched.integrationHooks) {
      patched.integrationHooks = []; repairedCount++;
    } else if (field.includes('workflowStubs') && !patched.workflowStubs) {
      patched.workflowStubs = []; repairedCount++;
    }
  }

  if (repairedCount > 0) {
    return {
      repaired: true,
      data: patched,
      log: makeLog(stage, 'field_repair', errorInput, 'repaired',
        `Supplied typed defaults for ${repairedCount} missing field(s): ${errors.map(e => e.field).join(', ')}`),
    };
  }

  return {
    repaired: false,
    data: patched,
    log: makeLog(stage, 'field_repair', errorInput, 'escalated',
      'Could not determine defaults for all failing fields — escalating to re-prompt'),
  };
}

// ─── Strategy 3: Consistency repair ──────────────────────────────────────────
// Fixes broken cross-layer references programmatically where possible

export function consistencyRepair(
  data: Record<string, unknown>,
  errors: Array<{ field: string; message: string; code: string }>,
  stage: StageName,
  knownEntities?: string[],
): RepairResult {
  const errorInput = JSON.stringify(errors).slice(0, 200);
  const patched = JSON.parse(JSON.stringify(data)); // deep clone
  let repairedCount = 0;

  for (const err of errors) {
    // Fix page_missing_api: add a stub endpoint for orphaned pages
    if (err.code === 'page_missing_api' && Array.isArray(patched.pages) && Array.isArray(patched.apiEndpoints)) {
      const pageNameMatch = err.message.match(/Page "([^"]+)"/);
      const entityMatch = err.message.match(/entity: ([^\)]+)\)/);
      if (pageNameMatch && entityMatch) {
        const entity = entityMatch[1].trim();
        patched.apiEndpoints.push({
          path: `/${entity.toLowerCase()}s`,
          method: 'GET',
          handlerDescription: `List all ${entity} records`,
          boundEntity: entity,
          authRequired: true,
          rateLimitFlag: false,
        });
        repairedCount++;
      }
    }

    // Fix invalid_workflow_entity: remove stubs referencing unknown entities
    if (err.code === 'invalid_workflow_entity' && Array.isArray(patched.workflowStubs) && knownEntities) {
      patched.workflowStubs = patched.workflowStubs.filter(
        (s: { trigger?: { entity?: string } }) => knownEntities.includes(s.trigger?.entity ?? '')
      );
      repairedCount++;
    }

    // Fix unregistered_integration: remove hooks/stubs with bad integration IDs
    if (err.code === 'unregistered_integration') {
      if (Array.isArray(patched.integrationHooks)) {
        const before = patched.integrationHooks.length;
        patched.integrationHooks = patched.integrationHooks.filter(
          (h: { integrationId?: string }) => h.integrationId !== err.field.split('.')[1]
        );
        if (patched.integrationHooks.length < before) repairedCount++;
      }
      if (Array.isArray(patched.workflowStubs)) {
        patched.workflowStubs = patched.workflowStubs.filter(
          (s: { integration?: string }) => s.integration !== undefined
        );
      }
    }

    // Fix missing_tenant_id: add tenantId field to entities
    if (err.code === 'missing_tenant_id' && Array.isArray(patched.entities)) {
      for (const entity of patched.entities) {
        const hasTenant = entity.fields?.some((f: { name: string }) => f.name === 'tenantId');
        if (!hasTenant) {
          entity.fields = entity.fields ?? [];
          entity.fields.push({
            name: 'tenantId',
            type: 'uuid',
            nullable: false,
            isPrimary: false,
            isUnique: false,
            isRelation: false,
          });
          repairedCount++;
        }
      }
    }
  }

  if (repairedCount > 0) {
    return {
      repaired: true,
      data: patched,
      log: makeLog(stage, 'consistency_repair', errorInput, 'repaired',
        `Resolved ${repairedCount} cross-layer consistency issue(s) programmatically`),
    };
  }

  return {
    repaired: false,
    data: patched,
    log: makeLog(stage, 'consistency_repair', errorInput, 'escalated',
      'Could not resolve consistency issues programmatically — requires re-prompt'),
  };
}

// ─── Re-prompt repair ─────────────────────────────────────────────────────────
// Last resort: send targeted correction prompt to the same model

export async function repromptRepair(
  originalOutput: string,
  errors: Array<{ field: string; message: string }>,
  stage: StageName,
  systemPrompt: string,
): Promise<RepairResult> {
  const errorInput = JSON.stringify(errors).slice(0, 200);
  const cfg = ROUTING_CONFIG.repair;

  const correctionPrompt = `The following JSON output failed validation with these errors:
${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}

Original output:
${originalOutput.slice(0, 2000)}

Return ONLY the corrected JSON with all errors fixed. No explanation, no markdown fences.`;

  try {
    const response = await gatewayCall(cfg.primary, cfg.fallback, systemPrompt, correctionPrompt);
    const extracted = extractJSON(response.text);
    const parsed = JSON.parse(extracted);
    return {
      repaired: true,
      data: parsed,
      log: makeLog(stage, 'field_repair', errorInput, 'repaired',
        `Re-prompt repair succeeded using ${response.cost.provider}/${response.cost.model}`),
    };
  } catch (err) {
    return {
      repaired: false,
      data: null,
      log: makeLog(stage, 'field_repair', errorInput, 'failed',
        `Re-prompt repair failed: ${err instanceof Error ? err.message : String(err)}`),
    };
  }
}