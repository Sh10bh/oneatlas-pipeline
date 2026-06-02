import { z } from 'zod';
import { APP_TYPES } from '../../types/AppIntent';

// ─── AppIntent ────────────────────────────────────────────────────────────────

export const AppIntentSchema = z.object({
  appName: z.string().min(1, 'appName is required'),
  appType: z.enum(APP_TYPES),
  features: z.array(z.string().min(1)).min(1, 'At least one feature required'),
  entities: z.array(z.string().min(1)).min(1, 'At least one entity required'),
  integrations_requested: z.array(z.string()),
  assumptions: z.array(z.string()),
  clarification_required: z
    .object({ flag: z.literal(true), question: z.string().min(1) })
    .optional(),
});

// ─── DataSchema ───────────────────────────────────────────────────────────────

const FieldTypeSchema = z.enum([
  'string', 'number', 'boolean', 'date', 'datetime',
  'uuid', 'text', 'json', 'enum',
]);

const RelationTypeSchema = z.enum(['hasMany', 'belongsTo', 'hasOne']);
const OnDeleteSchema = z.enum(['CASCADE', 'SET_NULL', 'RESTRICT']);

const FieldSchemaZ = z.object({
  name: z.string().min(1),
  type: FieldTypeSchema,
  nullable: z.boolean(),
  isPrimary: z.boolean(),
  isUnique: z.boolean(),
  isRelation: z.boolean(),
  enumValues: z.array(z.string()).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const RelationSchemaZ = z.object({
  type: RelationTypeSchema,
  target: z.string().min(1),
  foreignKey: z.string().min(1),
  onDelete: OnDeleteSchema,
});

export const EntitySchemaZ = z.object({
  name: z.string().min(1),
  tableName: z.string().regex(/^[a-z_]+$/, 'tableName must be snake_case'),
  fields: z.array(FieldSchemaZ).min(1),
  relations: z.array(RelationSchemaZ),
});

export const DataSchemaZ = z.object({
  entities: z.array(EntitySchemaZ).min(1, 'At least one entity required'),
});

// ─── AppSpec ──────────────────────────────────────────────────────────────────

const ComponentTypeSchema = z.enum(['table', 'form', 'chart', 'card']);
const PageLayoutSchema = z.enum(['list', 'detail', 'dashboard', 'settings']);
const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const PermissionActionSchema = z.enum(['read', 'write', 'delete']);
const EntityEventSchema = z.enum(['created', 'updated', 'deleted', 'status_changed']);

const PageComponentZ = z.object({
  type: ComponentTypeSchema,
  label: z.string().min(1),
  boundFields: z.array(z.string()).optional(),
});

const PageZ = z.object({
  name: z.string().min(1),
  route: z.string().refine((val) => val.startsWith('/'),{message : 'Must start with /'}),
  layout: PageLayoutSchema,
  boundEntity: z.string().min(1),
  components: z.array(PageComponentZ).min(1),
});

const ApiEndpointZ = z.object({
  path: z.string().refine((val) => val.startsWith('/'), {message : 'Must start with /'}),
  method: HttpMethodSchema,
  handlerDescription: z.string().min(1),
  boundEntity: z.string().min(1),
  authRequired: z.boolean(),
  rateLimitFlag: z.boolean(),
});

const RolePermissionZ = z.object({
  entity: z.string().min(1),
  actions: z.array(PermissionActionSchema).min(1),
});

const AuthRuleZ = z.object({
  role: z.string().min(1),
  permissions: z.array(RolePermissionZ).min(1),
});

const WorkflowTriggerZ = z.object({
  entity: z.string().min(1),
  event: EntityEventSchema,
  condition: z.string().optional(),
});

const IntegrationHookZ = z.object({
  integrationId: z.string().min(1),
  triggerEntity: z.string().min(1),
  triggerEvent: EntityEventSchema,
  actionId: z.string().min(1),
  description: z.string().min(1),
});

const WorkflowStubZ = z.object({
  name: z.string().min(1),
  trigger: WorkflowTriggerZ,
  integration: z.string().min(1),
  action: z.string().min(1),
  payload: z.record(z.string()),
});

export const AppSpecZ = z.object({
  appName: z.string().min(1),
  pages: z.array(PageZ).min(1, 'At least one page required'),
  apiEndpoints: z.array(ApiEndpointZ).min(1, 'At least one endpoint required'),
  authRules: z.array(AuthRuleZ).min(1, 'At least one auth rule required'),
  integrationHooks: z.array(IntegrationHookZ),
  workflowStubs: z.array(WorkflowStubZ),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type AppIntentZType = z.infer<typeof AppIntentSchema>;
export type DataSchemaZType = z.infer<typeof DataSchemaZ>;
export type AppSpecZType = z.infer<typeof AppSpecZ>;