export const APP_TYPES = [
  'crm',
  'project_management',
  'ecommerce',
  'hr_tool',
  'inventory',
  'content_platform',
  'analytics',
  'custom',
] as const;

export type AppType = (typeof APP_TYPES)[number];

export interface AppIntent {
  appName: string;
  appType: AppType;
  features: string[];
  entities: string[];
  integrations_requested: string[];
  assumptions: string[];
  clarification_required?: {
    flag: true;
    question: string;
  };
}