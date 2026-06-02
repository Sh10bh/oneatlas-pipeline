import type { Integration } from '../types/Integration';

export const webhookIntegration: Integration = {
  id: 'webhook',
  displayName: 'Webhook (Generic)',
  authType: 'webhook_secret',
  description: 'POST a signed payload to any configured URL',
  implemented: true,
  triggers: [
    {
      id: 'webhook.any',
      label: 'Any Trigger',
      entityEvents: ['created', 'updated', 'deleted', 'status_changed'],
      description: 'Triggers on any entity event',
    },
  ],
  actions: [
    {
      id: 'post_payload',
      label: 'POST Payload',
      description: 'POST a structured payload to a URL with HMAC signature header',
      stubbed: false,
      inputSchema: [
        { name: 'url', type: 'string', required: true, description: 'Target webhook URL' },
        { name: 'payload', type: 'json', required: true, description: 'JSON payload to send' },
        { name: 'secret', type: 'string', required: false, description: 'HMAC secret for X-Signature header' },
        { name: 'headers', type: 'json', required: false, description: 'Additional HTTP headers' },
      ],
      outputSchema: [
        { name: 'statusCode', type: 'number', required: true, description: 'HTTP response status code' },
        { name: 'success', type: 'boolean', required: true, description: 'Whether the webhook was delivered' },
      ],
    },
  ],
};
