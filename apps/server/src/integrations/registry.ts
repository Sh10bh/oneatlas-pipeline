
import type { Integration } from '../types/Integration';

class IntegrationRegistry {
  private registry: Map<string, Integration> = new Map();

  register(integration: Integration): void {
    this.registry.set(integration.id, integration);
  }

  get(id: string): Integration | undefined {
    return this.registry.get(id);
  }

  getAll(): Integration[] {
    return Array.from(this.registry.values());
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  getImplemented(): Integration[] {
    return this.getAll().filter((i) => i.implemented);
  }

  getStubbed(): Integration[] {
    return this.getAll().filter((i) => !i.implemented);
  }
}

export const integrationRegistry = new IntegrationRegistry();

// These two functions are used by the validation engine
export function isValidIntegrationId(id: string): boolean {
  return integrationRegistry.has(id);
}

export function isValidActionId(integrationId: string, actionId: string): boolean {
  const integration = integrationRegistry.get(integrationId);
  if (!integration) return false;
  return integration.actions.some((a) => a.id === actionId);
}


