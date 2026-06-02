export type PageLayout = 'list' | 'detail' | 'dashboard' | 'settings';
export type ComponentType = 'table' | 'form' | 'chart' | 'card';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type PermissionAction = 'read' | 'write' | 'delete';
export type EntityEvent = 'created' | 'updated' | 'deleted' | 'status_changed';

export interface PageComponent {
  type: ComponentType;
  label: string;
  boundFields?: string[];
}

export interface Page {
  name: string;
  route: string;
  layout: PageLayout;
  boundEntity: string;
  components: PageComponent[];
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  handlerDescription: string;
  boundEntity: string;
  authRequired: boolean;
  rateLimitFlag: boolean;
}

export interface RolePermission {
  entity: string;
  actions: PermissionAction[];
}

export interface AuthRule {
  role: string;
  permissions: RolePermission[];
}

export interface WorkflowTrigger {
  entity: string;
  event: EntityEvent;
  condition?: string;
}

export interface IntegrationHook {
  integrationId: string;
  triggerEntity: string;
  triggerEvent: EntityEvent;
  actionId: string;
  description: string;
}

export interface WorkflowStub {
  name: string;
  trigger: WorkflowTrigger;
  integration: string;
  action: string;
  payload: Record<string, string>;
}

export interface AppSpec {
  appName: string;
  pages: Page[];
  apiEndpoints: ApiEndpoint[];
  authRules: AuthRule[];
  integrationHooks: IntegrationHook[];
  workflowStubs: WorkflowStub[];
}