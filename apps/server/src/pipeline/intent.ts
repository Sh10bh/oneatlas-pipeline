import { gatewayCall, extractJSON } from '../gateway';
import { ROUTING_CONFIG, applyStagePolicy } from '../config/model-routing';
import { validateAppIntent } from '../validation';
import { structuralRepair, fieldRepair, repromptRepair } from '../repair/strategies';
import type { AppIntent } from '../types/AppIntent';
import type { StageCost } from '../types/JobState';
import type { RepairLog } from '../types/RepairLog';

const SYSTEM_PROMPT = `You are an AI that extracts structured application intent from user descriptions.
Return ONLY valid JSON matching this exact structure — no explanation, no markdown fences:
{
  "appName": "string",
  "appType": "crm|project_management|ecommerce|hr_tool|inventory|content_platform|analytics|custom",
  "features": ["string"],
  "entities": ["string"],
  "integrations_requested": ["string"],
  "assumptions": ["string"]
}
If the prompt is vague (under 10 meaningful words), add:
  "clarification_required": { "flag": true, "question": "one specific question" }
Always populate assumptions with any decisions you made about unclear requirements.`;

export interface IntentExtractionResult {
  intent: AppIntent;
  cost: StageCost;
  repairLogs: RepairLog[];
  retryCount: number;
}

export async function extractIntent(prompt: string): Promise<IntentExtractionResult> {
  const cfg = applyStagePolicy(ROUTING_CONFIG.intentExtraction);
  const repairLogs: RepairLog[] = [];
  let retryCount = 0;

  // Initial call
  const response = await gatewayCall(cfg.primary, cfg.fallback, SYSTEM_PROMPT, prompt);
  let rawText = response.text;

  // Attempt validation
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJSON(rawText));
  } catch {
    // Strategy 1: structural repair
    const repair = structuralRepair(rawText, 'intent_extraction');
    repairLogs.push(repair.log);
    if (repair.repaired) {
      parsed = repair.data;
    } else {
      // Re-prompt once
      retryCount++;
      const retry = await repromptRepair(
        rawText,
        [{ field: 'root', message: 'Invalid JSON' }],
        'intent_extraction',
        SYSTEM_PROMPT,
        response.cost,
      );
      repairLogs.push(retry.log);
      parsed = retry.data ?? {};
    }
  }

  let validation = validateAppIntent(parsed);

  if (!validation.success) {
    // Strategy 2: field repair
    const repair = fieldRepair(parsed as Record<string, unknown>, validation.errors, 'intent_extraction');
    repairLogs.push(repair.log);
    if (repair.repaired) {
      validation = validateAppIntent(repair.data);
      parsed = repair.data;
    }
  }

  if (!validation.success) {
    // Final re-prompt
    retryCount++;
    const repair = await repromptRepair(rawText, validation.errors, 'intent_extraction', SYSTEM_PROMPT, response.cost);
    repairLogs.push(repair.log);
    if (repair.repaired) {
      validation = validateAppIntent(repair.data);
      parsed = repair.data;
    }
  }

  if (!validation.success) {
    throw new Error(`Intent extraction failed after repairs: ${JSON.stringify(validation.errors)}`);
  }

  return {
    intent: validation.data,
    cost: response.cost,
    repairLogs,
    retryCount,
  };
}