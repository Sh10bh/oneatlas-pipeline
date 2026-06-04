import type { DataSchema } from '../types/DataSchema';
import { integrationRegistry, resolveIntegrationId } from '../integrations/registry';

// ─── Master alias table ───────────────────────────────────────────────────────
const INTEGRATION_ALIASES: Record<string, string> = {
  // email variants
  email: 'gmail',
  'email-service': 'gmail',
  'email-notifications': 'gmail',
  email_service: 'gmail',
  email_notifications: 'gmail',
  'google-mail': 'gmail',
  google_mail: 'gmail',
  'google-workspace': 'gmail',
  google_workspace: 'gmail',
  // sheets variants
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
  whatsapp_notifications: 'whatsapp',
  'whatsapp-notifications': 'whatsapp',
  // twilio variants
  sms: 'twilio-sms',
  twilio: 'twilio-sms',
  twilio_sms: 'twilio-sms',
  twilio_notifications: 'twilio-sms',
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
  'file-uploads': 'webhook',
  file_uploads: 'webhook',
  s3: 'webhook',
  'aws-s3': 'webhook',
  // calendar
  'google-calendar': 'gmail',
  google_calendar: 'gmail',
  calendar: 'gmail',
  // health/medical
  'electronic-health-records': 'webhook',
  'electronic-health-record': 'webhook',
  'electronic-health-record-systems': 'webhook',
  'electronic-health-records-systems': 'webhook',
  'electronic-health-records-(ehr)-systems': 'webhook',
  'electronic-health-records-(ehr)': 'webhook',
  ehr: 'webhook',
  'medical-records': 'webhook',
  medical_records: 'webhook',
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
  // generic
  notifications: 'webhook',
  'push-notifications': 'webhook',
  push_notifications: 'webhook',
};

/** Normalize integration id: "Slack" -> "slack", aliases -> registry id */
export function normalizeIntegrationId(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '-');
  // Check alias table first
  if (INTEGRATION_ALIASES[trimmed]) return INTEGRATION_ALIASES[trimmed];
  // Then check registry resolver
  const resolved = resolveIntegrationId(trimmed);
  if (resolved) return resolved;
  return trimmed;
}

export function normalizeRequestedIntegrations(requested: string[]): string[] {
  return [...new Set(requested.map(normalizeIntegrationId).filter(Boolean))];
}

/**
 * Deterministic cleanup before validation — fixes common LLM mistakes without another API call.
 */
export function normalizeAppSpecInput(
  input: Record<string, unknown>,
  schema: DataSchema,
  requestedIntegrations: string[] = [],
): Record<string, unknown> {
  const patched = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  const entityNames = schema.entities.map((e) => e.name);
  const defaultEntity = entityNames[0] ?? 'User';

  // ─── Normalize action IDs ─────────────────────────────────────────────────
  const ACTION_ALIASES: Record<string, Record<string, string>> = {
    whatsapp: {
      send_message: 'send_template_message',
      'send-message': 'send_template_message',
      sendMessage: 'send_template_message',
      notify: 'send_template_message',
      send_notification: 'send_template_message',
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
    },
    slack: {
      'send-message': 'send_channel_message',
      sendMessage: 'send_channel_message',
      notify: 'send_channel_message',
      send_message: 'send_channel_message',
      'post-message': 'send_channel_message',
      send: 'send_channel_message',
    },
    gmail: {
      send: 'send_email',
      'send-email': 'send_email',
      sendEmail: 'send_email',
      email: 'send_email',
      'send-mail': 'send_email',
      notify: 'send_email',
      default_action: 'send_email',
    },
    jira: {
      'create-issue': 'create_issue',
      createIssue: 'create_issue',
      'create-ticket': 'create_issue',
      createTicket: 'create_issue',
      'update-issue': 'update_issue_status',
    },
    webhook: {
      send: 'post_payload',
      trigger: 'post_payload',
      'send-payload': 'post_payload',
      notify: 'post_payload',
      default_action: 'post_payload',
    },
  };

  function normalizeActionId(integrationId: string, actionId: string): string {
    const aliases = ACTION_ALIASES[integrationId] ?? {};
    if (aliases[actionId]) return aliases[actionId];
    // If action doesn't exist in registry, fall back to first valid action
    const validActions = integrationRegistry.get(integrationId)?.actions ?? [];
    const isValid = validActions.some((a) => a.id === actionId);
    if (!isValid && validActions.length > 0) return validActions[0].id;
    return actionId;
  }

  if (Array.isArray(patched.integrationHooks)) {
    const seenHooks = new Set<string>();
    patched.integrationHooks = patched.integrationHooks
      .map((hook: Record<string, unknown>) => {
        const integrationId = normalizeIntegrationId(String(hook.integrationId ?? ''));
        const actionId = normalizeActionId(integrationId, String(hook.actionId ?? ''));
        return {
          ...hook,
          integrationId,
          actionId,
          triggerEntity: entityNames.includes(String(hook.triggerEntity))
            ? hook.triggerEntity
            : defaultEntity,
          triggerEvent: hook.triggerEvent ?? 'status_changed',
        };
      })
      .filter((hook: Record<string, unknown>) => {
        // Remove hooks with unregistered integrations
        if (!integrationRegistry.has(String(hook.integrationId))) return false;
        const dedupeKey = `${hook.integrationId}|${hook.actionId}|${hook.triggerEntity}|${hook.triggerEvent}`;
        if (seenHooks.has(dedupeKey)) return false;
        seenHooks.add(dedupeKey);
        return true;
      });
  }

  if (Array.isArray(patched.workflowStubs)) {
    patched.workflowStubs = patched.workflowStubs
      .map((stub: Record<string, unknown>) => {
        const trigger = (stub.trigger ?? {}) as Record<string, unknown>;
        const integration = normalizeIntegrationId(String(stub.integration ?? ''));
        const action = normalizeActionId(integration, String(stub.action ?? ''));
        // Flatten payload values to strings
        const rawPayload = (stub.payload ?? {}) as Record<string, unknown>;
        const payload: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawPayload)) {
          payload[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
        return {
          ...stub,
          integration,
          action,
          payload,
          trigger: {
            ...trigger,
            entity: entityNames.includes(String(trigger.entity)) ? trigger.entity : defaultEntity,
          },
        };
      })
      .filter((stub: Record<string, unknown>) => {
        // Remove stubs with unregistered integrations
        return integrationRegistry.has(String(stub.integration));
      });
  }

  if (Array.isArray(patched.authRules)) {
    patched.authRules = patched.authRules.map((rule: Record<string, unknown>) => {
      const permissions = Array.isArray(rule.permissions) ? rule.permissions : [];
      const validPermissions = permissions.filter((p: Record<string, unknown>) =>
        entityNames.includes(String(p.entity)),
      );
      if (validPermissions.length === 0 && entityNames.length > 0) {
        validPermissions.push({ entity: defaultEntity, actions: ['read', 'write'] });
      }
      return { ...rule, permissions: validPermissions };
    });
  }

  const normalizedRequested = normalizeRequestedIntegrations(requestedIntegrations);
  if (normalizedRequested.length > 0) {
    patched.workflowStubs = Array.isArray(patched.workflowStubs) ? patched.workflowStubs : [];
    const stubs = patched.workflowStubs as Array<Record<string, unknown>>;
    const present = new Set(stubs.map((s) => normalizeIntegrationId(String(s.integration ?? ''))));

    for (const integrationId of normalizedRequested) {
      if (!integrationRegistry.has(integrationId)) continue;
      if (present.has(integrationId)) continue;
      const reg = integrationRegistry.get(integrationId);
      const action = reg?.actions[0]?.id ?? 'post_payload';
      stubs.push({
        name: `${integrationId} notification workflow`,
        trigger: { entity: defaultEntity, event: 'status_changed' },
        integration: integrationId,
        action,
        payload: { entityId: `${defaultEntity}.id` },
      });
      if (!Array.isArray(patched.integrationHooks)) patched.integrationHooks = [];
      (patched.integrationHooks as Array<Record<string, unknown>>).push({
        integrationId,
        triggerEntity: defaultEntity,
        triggerEvent: 'status_changed',
        actionId: action,
        description: `Auto hook for ${integrationId}`,
      });
    }
    patched.workflowStubs = stubs;
  }

  // Page/API entity alignment
  if (Array.isArray(patched.pages) && Array.isArray(patched.apiEndpoints)) {
    const pages = patched.pages as Array<Record<string, unknown>>;
    const endpoints = patched.apiEndpoints as Array<Record<string, unknown>>;
    for (const page of pages) {
      const entity = String(page.boundEntity ?? defaultEntity);
      const safeEntity = entityNames.includes(entity) ? entity : defaultEntity;
      page.boundEntity = safeEntity;
      const hasEndpoint = endpoints.some((ep) => ep.boundEntity === safeEntity);
      if (!hasEndpoint) {
        endpoints.push({
          path: `/${safeEntity.toLowerCase()}s`,
          method: 'GET',
          handlerDescription: `List ${safeEntity} records`,
          boundEntity: safeEntity,
          authRequired: true,
          rateLimitFlag: false,
        });
      }
    }
    patched.apiEndpoints = endpoints;
    patched.pages = pages;
  }

  return patched;
}