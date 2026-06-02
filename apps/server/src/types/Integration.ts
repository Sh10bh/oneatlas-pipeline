export type AuthType = 'oauth2' | 'api_key' | 'webhook_secret' | 'none';
export type EntityEvent = 'created' | 'updated' | 'deleted' | 'status_changed';

export interface TriggerDescriptor {
  id: string;
  label: string;
  entityEvents: EntityEvent[];
  description: string;
}

export interface ActionInputField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ActionDescriptor {
  id: string;
  label: string;
  description: string;
  inputSchema: ActionInputField[];
  outputSchema: ActionInputField[];
  stubbed: boolean;
}

export interface Integration {
  id: string;
  displayName: string;
  authType: AuthType;
  description: string;
  triggers: TriggerDescriptor[];
  actions: ActionDescriptor[];
  implemented: boolean;
}

