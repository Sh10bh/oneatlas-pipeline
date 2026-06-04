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
- Relations MUST be bidirectionally consistent. If A hasMany B then B MUST have belongsTo A. If Supplier hasMany Product then Product MUST have belongsTo Supplier. If Payment belongsTo Order then Order MUST have hasMany Payment.
- tableName must be snake_case
- Include id (uuid, primary) and tenantId on every entity
- Double check every relation has its inverse before returning`;

export interface SchemaGenerationResult {
  schema: DataSchema;
  cost: StageCost;
  repairLogs: RepairLog[];
  retryCount: number;
}

async function runSchemaRepairPasses(
  parsed: unknown,
  repairLogs: RepairLog[],
  maxPasses: number = 4,
): Promise<{ parsed: unknown; valid: boolean; errors: Array<{ field: string; message: string; code: string }> }> {
  let data = parsed;
  let validation = validateDataSchema(data);

  for (let attempt = 0; !validation.success && attempt < maxPasses; attempt++) {
    // Always try consistency repair first — fixes missing_inverse_relation
    const consistencyFix = consistencyRepair(
      data as Record<string, unknown>,
      validation.errors,
      'schema_generation',
    );
    repairLogs.push(consistencyFix.log);
    if (consistencyFix.repaired) {
      data = consistencyFix.data;
      validation = validateDataSchema(data);
      if (validation.success) break;
    }

    // Then field repair for missing fields
    const fieldFix = fieldRepair(
      data as Record<string, unknown>,
      validation.errors,
      'schema_generation',
    );
    repairLogs.push(fieldFix.log);
    if (fieldFix.repaired) {
      data = fieldFix.data;
      validation = validateDataSchema(data);
      if (validation.success) break;
    }

    // If neither repaired anything this pass, stop early
    if (!consistencyFix.repaired && !fieldFix.repaired) break;
  }

  return {
    parsed: data,
    valid: validation.success,
    errors: validation.success ? [] : validation.errors,
  };
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
Assumptions: ${intent.assumptions.join(', ')}

IMPORTANT: Every relation must have its inverse. Examples:
- If Supplier hasMany Product → Product must have belongsTo Supplier
- If Order hasMany Payment → Payment must have belongsTo Order
- If Project hasMany Task → Task must have belongsTo Project`;

  const response = await gatewayCall(cfg.primary, cfg.fallback, SYSTEM_PROMPT, userPrompt);
  const rawText = response.text;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    const repair = structuralRepair(rawText, 'schema_generation');
    repairLogs.push(repair.log);
    parsed = repair.repaired ? repair.data : {};
  }

  // Run up to 4 repair passes on initial output
  let result = await runSchemaRepairPasses(parsed, repairLogs, 4);

  // Only reprompt if still failing after all repair passes
  if (!result.valid) {
    retryCount++;
    const reprompt = await repromptRepair(
      rawText,
      result.errors,
      'schema_generation',
      SYSTEM_PROMPT,
      response.cost,
    );
    repairLogs.push(reprompt.log);

    if (reprompt.repaired) {
      // Run repair passes on reprompted output too
      result = await runSchemaRepairPasses(reprompt.data, repairLogs, 4);
    }
  }

  if (!result.valid) {
    throw new Error(`Schema generation failed after repairs: ${JSON.stringify(result.errors)}`);
  }

  const finalValidation = validateDataSchema(result.parsed);
  if (!finalValidation.success) {
    throw new Error(`Schema generation failed after repairs: ${JSON.stringify(finalValidation.errors)}`);
  }

  return { schema: finalValidation.data, cost: response.cost, repairLogs, retryCount };
}