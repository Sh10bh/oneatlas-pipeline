import type { Integration } from '../types/Integration';

export const zapierIntegration: Integration = {
  id: 'zapier',
  displayName: 'Zapier (via Webhook)',
  authType: 'webhook_secret',
  description: 'Send structured payloads to Zapier webhook URLs — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'zapier.any',
      label: 'Any Trigger',
      entityEvents: ['created', 'updated', 'deleted', 'status_changed'],
      description: 'Triggers on any entity event',
    },
  ],
  actions: [
    {
      id: 'send_to_zapier',
      label: 'Send to Zapier',
      description: 'POST a structured payload to a Zapier webhook — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'webhookUrl', type: 'string', required: true, description: 'Zapier webhook URL' },
        { name: 'payload', type: 'json', required: true, description: 'Data payload to send' },
      ],
      outputSchema: [
        { name: 'success', type: 'boolean', required: true, description: 'Whether delivery succeeded' },
      ],
    },
  ],
};
