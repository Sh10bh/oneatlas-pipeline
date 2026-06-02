import { gatewayCall, extractJSON } from '../gateway';
import { ROUTING_CONFIG, applyStagePolicy } from '../config/model-routing';
import { validateDataSchema } from '../validation';
import { structuralRepair, fieldRepair, consistencyRepair, repromptRepair } from '../repair/strategies';
import type { AppIntent } from '../types/AppIntent';
import type { DataSchema } from '../types/DataSchema';
import type { StageCost } from '../types/JobState';
import type { RepairLog } from '../types/RepairLog';

const SYSTEM_PROMPT = `You are an AI that generates database schemas from application intent.
Return ONLY valid JSON matching this exact structure — no explanation, no markdown fences:
{
  "entities": [
    {
      "name": "EntityName",
      "tableName": "entity_name",
      "fields": [
        { "name": "id", "type": "uuid", "nullable": false, "isPrimary": true, "isUnique": true, "isRelation": false },
        { "name": "tenantId", "type": "uuid", "nullable": false, "isPrimary": false, "isUnique": false, "isRelation": false }
      ],
      "relations": [
        { "type": "hasMany|belongsTo|hasOne", "target": "OtherEntity", "foreignKey": "entityId", "onDelete": "CASCADE|SET_NULL|RESTRICT" }
      ]
    }
  ]
}
Rules:
- EVERY entity MUST have a tenantId field
- Relations must be bidirectionally consistent (if A hasMany B, B must belongsTo A)
- tableName must be snake_case
- Include id (uuid, primary) and tenantId on every entity`;

export interface SchemaGenerationResult {
  schema: DataSchema;
  cost: StageCost;
  repairLogs: RepairLog[];
  retryCount: number;
}

export async function generateSchema(intent: AppIntent): Promise<SchemaGenerationResult> {
  const cfg = applyStagePolicy(ROUTING_CONFIG.schemaGeneration);
  const repairLogs: RepairLog[] = [];
  let retryCount = 0;

  const userPrompt = `Generate a complete database schema for this application:
App Name: ${intent.appName}
App Type: ${intent.appType}
Entities needed: ${intent.entities.join(', ')}
Features: ${intent.features.join(', ')}
Assumptions: ${intent.assumptions.join(', ')}`;

  const response = await gatewayCall(cfg.primary, cfg.fallback, SYSTEM_PROMPT, userPrompt);
  let rawText = response.text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    const repair = structuralRepair(rawText, 'schema_generation');
    repairLogs.push(repair.log);
    parsed = repair.repaired ? repair.data : {};
  }

  let validation = validateDataSchema(parsed);

  if (!validation.success) {
    // Try field repair first
    const fieldFix = fieldRepair(parsed as Record<string, unknown>, validation.errors, 'schema_generation');
    repairLogs.push(fieldFix.log);
    if (fieldFix.repaired) {
      validation = validateDataSchema(fieldFix.data);
      parsed = fieldFix.data;
    }
  }

  if (!validation.success) {
    // Try consistency repair
    const consistencyFix = consistencyRepair(
      parsed as Record<string, unknown>,
      validation.errors,
      'schema_generation',
    );
    repairLogs.push(consistencyFix.log);
    if (consistencyFix.repaired) {
      validation = validateDataSchema(consistencyFix.data);
      parsed = consistencyFix.data;
    }
  }

  if (!validation.success) {
    // Final re-prompt
    retryCount++;
    const reprompt = await repromptRepair(rawText, validation.errors, 'schema_generation', SYSTEM_PROMPT, response.cost);
    repairLogs.push(reprompt.log);
    if (reprompt.repaired) {
      validation = validateDataSchema(reprompt.data);
      parsed = reprompt.data;
    }
  }

  if (!validation.success) {
    throw new Error(`Schema generation failed after repairs: ${JSON.stringify(validation.errors)}`);
  }

  return { schema: validation.data, cost: response.cost, repairLogs, retryCount };
}