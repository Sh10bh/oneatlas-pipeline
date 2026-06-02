import type { Integration } from '../types/Integration';

export const whatsappIntegration: Integration = {
  id: 'whatsapp',
  displayName: 'WhatsApp (via Twilio)',
  authType: 'api_key',
  description: 'Send WhatsApp messages and notifications via Twilio',
  implemented: true,
  triggers: [
    {
      id: 'whatsapp.user_action',
      label: 'User Action',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on user actions in the app',
    },
  ],
  actions: [
    {
      id: 'send_template_message',
      label: 'Send Template Message',
      description: 'Send a pre-approved WhatsApp template message',
      stubbed: false,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient phone number with country code' },
        { name: 'templateSid', type: 'string', required: true, description: 'Twilio content template SID' },
        { name: 'variables', type: 'json', required: false, description: 'Template variable substitutions' },
      ],
      outputSchema: [
        { name: 'messageSid', type: 'string', required: true, description: 'Twilio message SID' },
        { name: 'status', type: 'string', required: true, description: 'Message delivery status' },
      ],
    },
    {
      id: 'send_notification',
      label: 'Send Notification',
      description: 'Send a plain WhatsApp notification message',
      stubbed: false,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient phone number with country code' },
        { name: 'body', type: 'string', required: true, description: 'Message body text' },
      ],
      outputSchema: [
        { name: 'messageSid', type: 'string', required: true, description: 'Twilio message SID' },
        { name: 'status', type: 'string', required: true, description: 'Message delivery status' },
      ],
    },
    {
      id: 'trigger_conversation',
      label: 'Trigger Conversation',
      description: 'Initiate a WhatsApp conversation flow',
      stubbed: false,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient phone number' },
        { name: 'conversationSid', type: 'string', required: true, description: 'Twilio conversation SID' },
      ],
      outputSchema: [
        { name: 'conversationSid', type: 'string', required: true, description: 'Active conversation SID' },
      ],
    },
  ],
};
