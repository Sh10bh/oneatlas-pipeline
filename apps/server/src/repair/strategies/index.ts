import { v4 as uuidv4 } from 'uuid';
import type { RepairLog, RepairStrategy, RepairOutcome } from '../../types/RepairLog';
import type { StageName } from '../../types/JobState';
import { gatewayCall, extractJSON } from '../../gateway';
import { ROUTING_CONFIG, type ModelConfig } from '../../config/model-routing';
import type { StageCost } from '../../types/JobState';
import { integrationRegistry } from '../../integrations/registry';
import { normalizeIntegrationId } from '../../validation/normalize-appspec';

export interface RepairResult {
  repaired: boolean;
  data: unknown;
  log: RepairLog;
}

function fillTerminalDefaults(stage: StageName, value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const data = value as Record<string, unknown>;

  if (stage === 'intent_extraction') {
    return {
      appName: typeof data.appName === 'string' ? data.appName : 'GeneratedApp',
      appType: typeof data.appType === 'string' ? data.appType : 'custom',
      features: Array.isArray(data.features) ? data.features : ['core feature'],
      entities: Array.isArray(data.entities) ? data.entities : ['User'],
      integrations_requested: Array.isArray(data.integrations_requested) ? data.integrations_requested : [],
      assumptions: Array.isArray(data.assumptions) ? data.assumptions : ['Assumed MVP scope from ambiguous prompt'],
      clarification_required: data.clarification_required,
    };
  }

  if (stage === 'schema_generation') {
    return {
      entities: Array.isArray(data.entities) ? data.entities : [],
    };
  }

  if (stage === 'appspec_generation') {
    return {
      appName: typeof data.appName === 'string' ? data.appName : 'GeneratedApp',
      pages: Array.isArray(data.pages) ? data.pages : [],
      apiEndpoints: Array.isArray(data.apiEndpoints) ? data.apiEndpoints : [],
      authRules: Array.isArray(data.authRules) ? data.authRules : [],
      integrationHooks: Array.isArray(data.integrationHooks) ? data.integrationHooks : [],
      workflowStubs: Array.isArray(data.workflowStubs) ? data.workflowStubs : [],
    };
  }

  return value;
}

function makeLog(
  stage: StageName,
  strategy: RepairStrategy,
  errorInput: string,
  outcome: RepairOutcome,
  details: string,
  extra?: { latencyMs?: number; estimatedCostUSD?: number },
): RepairLog {
  return {
    id: uuidv4(),
    stage,
    strategy,
    errorInput,
    outcome,
    attemptedAt: Date.now(),
    details,
    latencyMs: extra?.latencyMs,
    estimatedCostUSD: extra?.estimatedCostUSD,
  };
}

// ─── Integration + Action alias tables ───────────────────────────────────────

const INTEGRATION_ALIASES: Record<string, string> = {
  // email variants
  email: 'gmail',
  'email-service': 'gmail',
  'email-notifications': 'gmail',
  'email_service': 'gmail',
  'email_notifications': 'gmail',
  'google-mail': 'gmail',
  google_mail: 'gmail',
  'google-workspace': 'gmail',
  google_workspace: 'gmail',
  // sheets variants — FIX: all map to canonical registry id 'google_sheets'
  sheets: 'google_sheets',
  google_sheets: 'google_sheets',
  google_sheet: 'google_sheets',
  'google-sheets': 'google_sheets',
  'google-sheet': 'google_sheets',
  googlesheets: 'google_sheets',
  // whatsapp variants
  'whatsapp-api': 'whatsapp',
  whatsapp_api: 'whatsapp',
  whatsapp_business: 'whatsapp',
  'whatsapp-business': 'whatsapp',
  'whatsapp_notifications': 'whatsapp',
  'whatsapp-notifications': 'whatsapp',
  // twilio variants
  sms: 'twilio-sms',
  twilio: 'twilio-sms',
  twilio_sms: 'twilio-sms',
  'twilio_notifications': 'twilio-sms',
  // payment variants
  'payment-gateways': 'stripe',
  payment_gateways: 'stripe',
  payments: 'stripe',
  'payment-gateway': 'stripe',
  payment_gateway: 'stripe',
  'stripe-payments': 'stripe',
  // storage/drive
  'google-drive': 'webhook',
  google_drive: 'webhook',
  'file-storage': 'webhook',
  'file-storage-services': 'webhook',
  file_storage: 'webhook',
  s3: 'webhook',
  'aws-s3': 'webhook',
  'file-uploads': 'webhook',
  file_uploads: 'webhook',
  // calendar
  'google-calendar': 'gmail',
  google_calendar: 'gmail',
  calendar: 'gmail',
  // health/medical
  'electronic-health-records': 'webhook',
  'electronic-health-record': 'webhook',
  'electronic-health-record-systems': 'webhook',
  'electronic-health-records-systems': 'webhook',
  ehr: 'webhook',
  'medical-records': 'webhook',
  medical_records: 'webhook',
  'electronic-health-records-(ehr)-systems': 'webhook',
  'electronic-health-records-(ehr)': 'webhook',
  // analytics
  'analytics-tools': 'webhook',
  analytics_tools: 'webhook',
  'analytics-service': 'webhook',
  analytics_service: 'webhook',
  'analytics-platform': 'webhook',
  analytics: 'webhook',
  // chat
  'real-time-chat': 'webhook',
  real_time_chat: 'webhook',
  'chat-service': 'webhook',
  chat_service: 'webhook',
  chat: 'webhook',
  // marketplace
  marketplace: 'webhook',
  'marketplace-service': 'webhook',
  // generic notifications
  notifications: 'webhook',
  'push-notifications': 'webhook',
  push_notifications: 'webhook',
};

const ACTION_ALIASES: Record<string, Record<string, string>> = {
  whatsapp: {
    send_message: 'send_template_message',
    'send-message': 'send_template_message',
    sendMessage: 'send_template_message',
    notify: 'send_template_message',
    send_notification: 'send_template_message',
    sendNotification: 'send_template_message',
    send: 'send_template_message',
  },
  stripe: {
    'create-charge': 'create_charge',
    createCharge: 'create_charge',
    charge: 'create_charge',
    'create-customer': 'create_customer',
    createCustomer: 'create_customer',
    'process-payment': 'create_charge',
    processPayment: 'create_charge',
    'create-subscription': 'create_subscription',
    createSubscription: 'create_subscription',
  },
  slack: {
    'send-message': 'send_channel_message',
    sendMessage: 'send_channel_message',
    notify: 'send_channel_message',
    send_message: 'send_channel_message',
    'post-message': 'send_channel_message',
    postMessage: 'send_channel_message',
    send: 'send_channel_message',
  },
  gmail: {
    send: 'send_email',
    'send-email': 'send_email',
    sendEmail: 'send_email',
    email: 'send_email',
    'send-mail': 'send_email',
    sendMail: 'send_email',
    notify: 'send_email',
  },
  jira: {
    'create-issue': 'create_issue',
    createIssue: 'create_issue',
    'create-ticket': 'create_issue',
    createTicket: 'create_issue',
    'update-issue': 'update_issue_status',
    updateIssue: 'update_issue_status',
  },
  webhook: {
    send: 'post_payload',
    trigger: 'post_payload',
    'send-payload': 'post_payload',
    sendPayload: 'post_payload',
    notify: 'post_payload',
  },
};

// ─── Strategy 1: Structural repair ───────────────────────────────────────────

export function structuralRepair(rawText: string, stage: StageName): RepairResult {
  const errorInput = rawText.slice(0, 200);
  try {
    const extracted = extractJSON(rawText);
    const parsed = fillTerminalDefaults(stage, JSON.parse(extracted));
    return {
      repaired: true,
      data: parsed,
      log: makeLog(stage, 'structural_repair', errorInput, 'repaired',
        'Extracted valid JSON from malformed/fenced response'),
    };
  } catch {
    const partialMatch = rawText.match(/\{[\s\S]*/);
    if (partialMatch) {
      let partial = partialMatch[0];
      const opens = (partial.match(/\{/g) ?? []).length;
      const closes = (partial.match(/\}/g) ?? []).length;
      partial += '}'.repeat(Math.max(0, opens - closes));
      try {
        const parsed = fillTerminalDefaults(stage, JSON.parse(partial));
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

export function consistencyRepair(
  data: Record<string, unknown>,
  errors: Array<{ field: string; message: string; code: string }>,
  stage: StageName,
  knownEntities?: string[],
): RepairResult {
  const errorInput = JSON.stringify(errors).slice(0, 200);
  const patched = JSON.parse(JSON.stringify(data));
  let repairedCount = 0;

  for (const err of errors) {

    // Fix page_missing_api
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

    // FIX: invalid field type values — map SQL/unsupported types to our enum
    // THIS BLOCK WAS PREVIOUSLY NESTED INSIDE page_missing_api — now correctly top-level
    if (err.code === 'invalid_enum_value' && err.field.includes('.type') && Array.isArray(patched.entities)) {
      const TYPE_MAP: Record<string, string> = {
        varchar: 'string',
        'character varying': 'string',
        char: 'string',
        nvarchar: 'string',
        text: 'text',
        integer: 'number',
        int: 'number',
        int4: 'number',
        int8: 'number',
        bigint: 'number',
        smallint: 'number',
        float: 'number',
        double: 'number',
        decimal: 'number',
        numeric: 'number',
        real: 'number',
        timestamp: 'datetime',
        'timestamp without time zone': 'datetime',
        'timestamp with time zone': 'datetime',
        timestamptz: 'datetime',
        datetime: 'datetime',
        bool: 'boolean',
        tinyint: 'boolean',
        jsonb: 'json',
        array: 'json',
      };
      for (const entity of patched.entities) {
        if (!Array.isArray(entity.fields)) continue;
        for (const field of entity.fields) {
          if (field.type && TYPE_MAP[field.type]) {
            field.type = TYPE_MAP[field.type];
            repairedCount++;
          }
        }
      }
    }

    // FIX: invalid relation type values — map unsupported types to our enum
    if (err.code === 'invalid_enum_value' && err.field.includes('.relations.') && Array.isArray(patched.entities)) {
      const RELATION_TYPE_MAP: Record<string, string> = {
        belongsToMany: 'hasMany',
        manyToMany: 'hasMany',
        many_to_many: 'hasMany',
        'many-to-many': 'hasMany',
        hasAndBelongsToMany: 'hasMany',
        through: 'hasMany',
      };
      for (const entity of patched.entities) {
        if (!Array.isArray(entity.relations)) continue;
        for (const rel of entity.relations) {
          if (rel.type && RELATION_TYPE_MAP[rel.type]) {
            rel.type = RELATION_TYPE_MAP[rel.type];
            repairedCount++;
          }
        }
      }
    }

    // Fix invalid_workflow_entity
    if (err.code === 'invalid_workflow_entity' && Array.isArray(patched.workflowStubs) && knownEntities) {
      patched.workflowStubs = patched.workflowStubs.filter(
        (s: { trigger?: { entity?: string } }) => knownEntities.includes(s.trigger?.entity ?? '')
      );
      repairedCount++;
    }

    // Fix unregistered_integration — normalize aliases, then remove still-invalid ones
    if (err.code === 'unregistered_integration') {
      if (Array.isArray(patched.workflowStubs)) {
        for (const stub of patched.workflowStubs) {
          if (stub.integration && INTEGRATION_ALIASES[stub.integration]) {
            stub.integration = INTEGRATION_ALIASES[stub.integration];
            repairedCount++;
          }
        }
        patched.workflowStubs = patched.workflowStubs.filter(
          (s: { integration?: string }) =>
            !s.integration || integrationRegistry.has(s.integration)
        );
      }
      if (Array.isArray(patched.integrationHooks)) {
        for (const hook of patched.integrationHooks) {
          if (hook.integrationId && INTEGRATION_ALIASES[hook.integrationId]) {
            hook.integrationId = INTEGRATION_ALIASES[hook.integrationId];
            repairedCount++;
          }
        }
        patched.integrationHooks = patched.integrationHooks.filter(
          (h: { integrationId?: string }) =>
            !h.integrationId || integrationRegistry.has(h.integrationId)
        );
      }
    }

    // Fix invalid_integration_action — map wrong action names to valid ones
    if (err.code === 'invalid_integration_action') {
      if (Array.isArray(patched.integrationHooks)) {
        for (const hook of patched.integrationHooks) {
          const aliases = ACTION_ALIASES[hook.integrationId] ?? {};
          if (hook.actionId && aliases[hook.actionId]) {
            hook.actionId = aliases[hook.actionId];
            repairedCount++;
          } else if (hook.actionId && !integrationRegistry.get(hook.integrationId)?.actions.some(
            (a: { id: string }) => a.id === hook.actionId
          )) {
            const firstAction = integrationRegistry.get(hook.integrationId)?.actions[0]?.id;
            if (firstAction) { hook.actionId = firstAction; repairedCount++; }
          }
        }
      }
      if (Array.isArray(patched.workflowStubs)) {
        for (const stub of patched.workflowStubs) {
          const aliases = ACTION_ALIASES[stub.integration] ?? {};
          if (stub.action && aliases[stub.action]) {
            stub.action = aliases[stub.action];
            repairedCount++;
          } else if (stub.action && !integrationRegistry.get(stub.integration)?.actions.some(
            (a: { id: string }) => a.id === stub.action
          )) {
            const firstAction = integrationRegistry.get(stub.integration)?.actions[0]?.id;
            if (firstAction) { stub.action = firstAction; repairedCount++; }
          }
        }
      }
    }

    // Fix missing_tenant_id
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

    // Fix missing_inverse_relation
    if (err.code === 'missing_inverse_relation' && Array.isArray(patched.entities)) {
      const match = err.message.match(/Relation from "([^"]+)" to "([^"]+)"/);
      if (match) {
        const [, fromEntity, toEntity] = match;
        const targetEnt = patched.entities.find((e: { name: string }) => e.name === toEntity);
        if (targetEnt) {
          targetEnt.relations = targetEnt.relations ?? [];
          const alreadyHas = targetEnt.relations.some(
            (r: { target: string }) => r.target === fromEntity
          );
          if (!alreadyHas) {
            targetEnt.relations.push({
              type: 'hasMany',
              target: fromEntity,
              foreignKey: `${fromEntity.charAt(0).toLowerCase() + fromEntity.slice(1)}Id`,
              onDelete: 'CASCADE',
            });
            repairedCount++;
          }
        }
      }
    }

    // Fix invalid_auth_entity
    if (err.code === 'invalid_auth_entity' && Array.isArray(patched.authRules) && knownEntities) {
      const entityMatch = err.message.match(/entity "([^"]+)"/);
      const badEntity = entityMatch?.[1];
      const fallbackEntity = knownEntities[0];
      for (const rule of patched.authRules as Array<{ role: string; permissions: Array<{ entity: string }> }>) {
        rule.permissions = rule.permissions.filter((p) => p.entity !== badEntity);
        if (rule.permissions.length === 0) {
          (rule.permissions as Array<Record<string, unknown>>).push({ entity: fallbackEntity, actions: ['read', 'write'] });
        }
      }
      repairedCount++;
    }

    // Fix missing_requested_workflow_stub
    if (err.code === 'missing_requested_workflow_stub') {
      const integrationId = normalizeIntegrationId(err.field.split('.')[1] ?? '');
      const fallbackAction = integrationRegistry.get(integrationId)?.actions[0]?.id ?? 'default_action';
      const firstEntity = Array.isArray((patched as { pages?: Array<{ boundEntity?: string }> }).pages)
        ? (patched as { pages: Array<{ boundEntity?: string }> }).pages[0]?.boundEntity
        : undefined;
      const fallbackEntity = firstEntity ?? 'User';
      if (Array.isArray(patched.workflowStubs)) {
        patched.workflowStubs.push({
          name: `${integrationId} automation stub`,
          trigger: { entity: fallbackEntity, event: 'created' },
          integration: integrationId,
          action: fallbackAction,
          payload: { sourceEntity: fallbackEntity },
        });
        repairedCount++;
      }
      if (Array.isArray(patched.integrationHooks)) {
        patched.integrationHooks.push({
          integrationId,
          triggerEntity: fallbackEntity,
          triggerEvent: 'created',
          actionId: fallbackAction,
          description: `Auto-generated hook for ${integrationId}`,
        });
      }
    }

    // Fix invalid page layout values
    if (err.code === 'invalid_enum_value' && err.field.includes('layout') && Array.isArray(patched.pages)) {
      const layoutMap: Record<string, string> = {
        form: 'detail',
        grid: 'list',
        table: 'list',
        kanban: 'list',
        calendar: 'dashboard',
        analytics: 'dashboard',
        overview: 'dashboard',
        report: 'dashboard',
      };
      for (const page of patched.pages) {
        if (page.layout && layoutMap[page.layout]) {
          page.layout = layoutMap[page.layout];
          repairedCount++;
        }
      }
    }

    // Fix payload values that are objects/arrays instead of strings
    if (err.code === 'invalid_type' && err.field.includes('payload') && Array.isArray(patched.workflowStubs)) {
      for (const stub of patched.workflowStubs) {
        if (stub.payload && typeof stub.payload === 'object') {
          const flatPayload: Record<string, string> = {};
          for (const [k, v] of Object.entries(stub.payload as Record<string, unknown>)) {
            flatPayload[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
          stub.payload = flatPayload;
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

export async function repromptRepair(
  originalOutput: string,
  errors: Array<{ field: string; message: string }>,
  stage: StageName,
  systemPrompt: string,
  preferredModelCost?: Pick<StageCost, 'provider' | 'model'>,
): Promise<RepairResult> {
  const errorInput = JSON.stringify(errors).slice(0, 200);
  const cfg = ROUTING_CONFIG.repair;
  const preferredModel: ModelConfig | undefined = preferredModelCost
    ? {
        provider: preferredModelCost.provider as ModelConfig['provider'],
        model: preferredModelCost.model,
        maxTokens: cfg.primary.maxTokens,
      }
    : undefined;

  const correctionPrompt = `The following JSON output failed validation with these errors:
${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}

Original output:
${originalOutput.slice(0, 2000)}

Return ONLY the corrected JSON with all errors fixed. No explanation, no markdown fences.`;

  try {
    const startedAt = Date.now();
    const response = await gatewayCall(preferredModel ?? cfg.primary, cfg.fallback, systemPrompt, correctionPrompt);
    const extracted = extractJSON(response.text);
    const parsed = JSON.parse(extracted);
    const latencyMs = Date.now() - startedAt;
    return {
      repaired: true,
      data: parsed,
      log: makeLog(stage, 'field_repair', errorInput, 'repaired',
        `Re-prompt repair succeeded using ${response.cost.provider}/${response.cost.model}`,
        { latencyMs, estimatedCostUSD: response.cost.estimatedUSD }),
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