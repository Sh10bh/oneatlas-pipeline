import { gatewayCall, extractJSON } from '../gateway';
import { ROUTING_CONFIG, applyStagePolicy } from '../config/model-routing';
import { validateAppSpec } from '../validation';
import { structuralRepair, fieldRepair, consistencyRepair, repromptRepair } from '../repair/strategies';
import { integrationRegistry } from '../integrations/registry';
import type { AppIntent } from '../types/AppIntent';
import type { DataSchema } from '../types/DataSchema';
import type { AppSpec } from '../types/AppSpec';
import type { StageCost } from '../types/JobState';
import type { RepairLog } from '../types/RepairLog';

const SYSTEM_PROMPT = `You are an AI that generates complete application specifications from database schemas.
Return ONLY valid JSON — no explanation, no markdown fences.
Structure:
{
  "appName": "string",
  "pages": [{ "name": "string", "route": "/path", "layout": "list|detail|dashboard|settings", "boundEntity": "EntityName", "components": [{ "type": "table|form|chart|card", "label": "string" }] }],
  "apiEndpoints": [{ "path": "/path", "method": "GET|POST|PUT|PATCH|DELETE", "handlerDescription": "string", "boundEntity": "EntityName", "authRequired": true, "rateLimitFlag": false }],
  "authRules": [{ "role": "admin", "permissions": [{ "entity": "EntityName", "actions": ["read","write","delete"] }] }],
  "integrationHooks": [{ "integrationId": "slack", "triggerEntity": "EntityName", "triggerEvent": "created|updated|deleted|status_changed", "actionId": "send_channel_message", "description": "string" }],
  "workflowStubs": [{ "name": "string", "trigger": { "entity": "EntityName", "event": "status_changed", "condition": "optional" }, "integration": "slack", "action": "send_channel_message", "payload": { "channel": "entity.fieldName" } }]
}
Rules:
- Every page MUST have at least one apiEndpoint with the same boundEntity
- Every workflowStub must reference an entity that exists in the schema
- Integration IDs must be from: slack, stripe, whatsapp, gmail, jira, github, hubspot, webhook, notion, airtable, salesforce, twilio-sms, zapier, sheets`;

export interface AppSpecGenerationResult {
  appSpec: AppSpec;
  cost: StageCost;
  repairLogs: RepairLog[];
  retryCount: number;
}

export async function generateAppSpec(
  intent: AppIntent,
  schema: DataSchema,
): Promise<AppSpecGenerationResult> {
  const cfg = applyStagePolicy(ROUTING_CONFIG.appspecGeneration);
  const repairLogs: RepairLog[] = [];
  let retryCount = 0;

  const entitySummary = schema.entities
    .map(e => `${e.name} (fields: ${e.fields.map(f => f.name).join(', ')})`)
    .join('\n');

  const registeredIntegrations = integrationRegistry.getAll()
    .map(i => `${i.id}: actions=${i.actions.map(a => a.id).join(',')}`)
    .join('\n');

  const userPrompt = `Generate a complete AppSpec for:
App: ${intent.appName} (${intent.appType})
Features: ${intent.features.join(', ')}
Integrations requested: ${intent.integrations_requested.join(', ') || 'none'}

Entities in schema:
${entitySummary}

Available integrations and their actions:
${registeredIntegrations}

Generate at least one workflowStub per requested integration.
Every page must have a corresponding API endpoint.`;

  const response = await gatewayCall(cfg.primary, cfg.fallback, SYSTEM_PROMPT, userPrompt);
  let rawText = response.text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    const repair = structuralRepair(rawText, 'appspec_generation');
    repairLogs.push(repair.log);
    parsed = repair.repaired ? repair.data : {};
  }

  let validation = validateAppSpec(parsed, schema, intent.integrations_requested);

  if (!validation.success) {
    const knownEntities = schema.entities.map(e => e.name);
    const consistencyFix = consistencyRepair(
      parsed as Record<string, unknown>,
      validation.errors,
      'appspec_generation',
      knownEntities,
    );
    repairLogs.push(consistencyFix.log);
    if (consistencyFix.repaired) {
      validation = validateAppSpec(consistencyFix.data, schema, intent.integrations_requested);
      parsed = consistencyFix.data;
    }
  }

  if (!validation.success) {
    const fieldFix = fieldRepair(
      parsed as Record<string, unknown>,
      validation.errors,
      'appspec_generation',
    );
    repairLogs.push(fieldFix.log);
    if (fieldFix.repaired) {
      validation = validateAppSpec(fieldFix.data, schema, intent.integrations_requested);
      parsed = fieldFix.data;
    }
  }

  if (!validation.success) {
    retryCount++;
    const reprompt = await repromptRepair(rawText, validation.errors, 'appspec_generation', SYSTEM_PROMPT, response.cost);
    repairLogs.push(reprompt.log);
    if (reprompt.repaired) {
      validation = validateAppSpec(reprompt.data, schema, intent.integrations_requested);
      parsed = reprompt.data;
    }
  }

  if (!validation.success) {
    throw new Error(`AppSpec generation failed after repairs: ${JSON.stringify(validation.errors)}`);
  }

  return { appSpec: validation.data, cost: response.cost, repairLogs, retryCount };
}