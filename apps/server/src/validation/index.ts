import { ZodSchema, ZodError } from 'zod';
import { AppIntentSchema, DataSchemaZ, AppSpecZ } from './schemas';
import { AppIntent } from '../types/AppIntent';
import { DataSchema } from '../types/DataSchema';
import { AppSpec } from '../types/AppSpec';
import { isValidIntegrationId, isValidActionId } from '../integrations/registry';

export type ValidationErrorDetail = {
  field: string;
  message: string;
  code: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationErrorDetail[] };

// ─── Generic Zod validator ────────────────────────────────────────────────────

function validateWithSchema<T>(schema: ZodSchema<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: ValidationErrorDetail[] = (result.error as ZodError).errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
  return { success: false, errors };
}

// ─── Stage 1: AppIntent ───────────────────────────────────────────────────────

export function validateAppIntent(input: unknown): ValidationResult<AppIntent> {
  return validateWithSchema(AppIntentSchema, input) as ValidationResult<AppIntent>;
}

// ─── Stage 2: DataSchema — with cross-layer consistency checks ────────────────

export function validateDataSchema(input: unknown): ValidationResult<DataSchema> {
  const base = validateWithSchema(DataSchemaZ, input);
  if (!base.success) return base as ValidationResult<DataSchema>;

  const schema = base.data as DataSchema;
  const entityNames = new Set<string>(schema.entities.map((e) => e.name));
  const extraErrors: ValidationErrorDetail[] = [];

  for (const entity of schema.entities) {
    const hasTenantId = (entity.fields as Array<{ name: string }>).some((f) => f.name === 'tenantId');
    if (!hasTenantId) {
      extraErrors.push({
        field: `${entity.name}.fields`,
        message: `Entity "${entity.name}" is missing required tenantId field`,
        code: 'missing_tenant_id',
      });
    }

    for (const rel of entity.relations) {
      if (!entityNames.has(rel.target)) {
        extraErrors.push({
          field: `${entity.name}.relations`,
          message: `Relation target "${rel.target}" in entity "${entity.name}" does not exist in schema`,
          code: 'invalid_relation_target',
        });
      }
    }
  }

  // Bidirectional consistency check
  for (const entity of schema.entities) {
    for (const rel of entity.relations) {
      if (!entityNames.has(rel.target)) continue;
      const targetEntity = schema.entities.find((e) => e.name === rel.target);
      const hasInverse = targetEntity?.relations.some((r) => r.target === entity.name);
      if (!hasInverse) {
        extraErrors.push({
          field: `${entity.name}.relations → ${rel.target}`,
          message: `Relation from "${entity.name}" to "${rel.target}" has no inverse relation — bidirectional consistency required`,
          code: 'missing_inverse_relation',
        });
      }
    }
  }

  if (extraErrors.length > 0) return { success: false, errors: extraErrors };
  return { success: true, data: schema };
}

// ─── Stage 3: AppSpec — with cross-layer consistency checks ──────────────────

export function validateAppSpec(
  input: unknown,
  dataSchema?: DataSchema,
  requestedIntegrations?: string[],
): ValidationResult<AppSpec> {
  const base = validateWithSchema(AppSpecZ, input);
  if (!base.success) return base as ValidationResult<AppSpec>;

  const spec = base.data as AppSpec;
  const extraErrors: ValidationErrorDetail[] = [];

  // Every page must have at least one matching API endpoint
  for (const page of spec.pages) {
    const hasEndpoint = spec.apiEndpoints.some(
      (ep) => ep.boundEntity === page.boundEntity,
    );
    if (!hasEndpoint) {
      extraErrors.push({
        field: `pages.${page.name}`,
        message: `Page "${page.name}" (entity: ${page.boundEntity}) has no corresponding API endpoint`,
        code: 'page_missing_api',
      });
    }
  }

  if (dataSchema) {
    const entityNames = new Set(dataSchema.entities.map((e) => e.name));

    for (const stub of spec.workflowStubs) {
      if (!entityNames.has(stub.trigger.entity)) {
        extraErrors.push({
          field: `workflowStubs.${stub.name}`,
          message: `WorkflowStub "${stub.name}" references unknown entity "${stub.trigger.entity}"`,
          code: 'invalid_workflow_entity',
        });
      }
    }

    for (const hook of spec.integrationHooks) {
      if (!entityNames.has(hook.triggerEntity)) {
        extraErrors.push({
          field: `integrationHooks.${hook.integrationId}`,
          message: `IntegrationHook references unknown entity "${hook.triggerEntity}"`,
          code: 'invalid_hook_entity',
        });
      }
    }

    // Auth rule permissions must reference valid entities
    for (const rule of spec.authRules) {
      for (const permission of rule.permissions) {
        if (!entityNames.has(permission.entity)) {
          extraErrors.push({
            field: `authRules.${rule.role}.permissions`,
            message: `Auth rule for role "${rule.role}" references non-existent entity "${permission.entity}"`,
            code: 'invalid_auth_entity',
          });
        }
      }
    }
  }

  // Integration registry validation — hard errors, no silent fallback
  for (const hook of spec.integrationHooks) {
    if (!isValidIntegrationId(hook.integrationId)) {
      extraErrors.push({
        field: `integrationHooks.${hook.integrationId}`,
        message: `IntegrationHook references unregistered integration "${hook.integrationId}"`,
        code: 'unregistered_integration',
      });
    } else if (!isValidActionId(hook.integrationId, hook.actionId)) {
      extraErrors.push({
        field: `integrationHooks.${hook.integrationId}.actionId`,
        message: `Integration "${hook.integrationId}" has no action "${hook.actionId}"`,
        code: 'invalid_integration_action',
      });
    }
  }

  for (const stub of spec.workflowStubs) {
    if (!isValidIntegrationId(stub.integration)) {
      extraErrors.push({
        field: `workflowStubs.${stub.name}.integration`,
        message: `WorkflowStub "${stub.name}" references unregistered integration "${stub.integration}"`,
        code: 'unregistered_integration',
      });
    } else if (!isValidActionId(stub.integration, stub.action)) {
      extraErrors.push({
        field: `workflowStubs.${stub.name}.action`,
        message: `Integration "${stub.integration}" has no action "${stub.action}"`,
        code: 'invalid_integration_action',
      });
    }
  }

  if (requestedIntegrations && requestedIntegrations.length > 0) {
    const integrationSet = new Set(spec.workflowStubs.map((stub) => stub.integration));
    for (const integration of requestedIntegrations) {
      if (!integrationSet.has(integration)) {
        extraErrors.push({
          field: `workflowStubs.${integration}`,
          message: `Requested integration "${integration}" is missing a workflow stub`,
          code: 'missing_requested_workflow_stub',
        });
      }
    }
  }

  if (extraErrors.length > 0) return { success: false, errors: extraErrors };
  return { success: true, data: spec };
}