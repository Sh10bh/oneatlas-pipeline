import type { Integration } from '../types/Integration';

export const twilioSmsIntegration: Integration = {
  id: 'twilio_sms',
  displayName: 'Twilio SMS',
  authType: 'api_key',
  description: 'Send SMS notifications via Twilio — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'twilio_sms.user_action',
      label: 'User Action or Status Change',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on user actions or status changes',
    },
  ],
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Send an SMS notification — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient phone number' },
        { name: 'body', type: 'string', required: true, description: 'SMS message body' },
        { name: 'from', type: 'string', required: false, description: 'Twilio sender number' },
      ],
      outputSchema: [
        { name: 'messageSid', type: 'string', required: true, description: 'Twilio message SID' },
        { name: 'status', type: 'string', required: true, description: 'Message status' },
      ],
    },
    {
      id: 'trigger_otp',
      label: 'Trigger OTP Flow',
      description: 'Send an OTP via Twilio Verify — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient phone number' },
        { name: 'serviceSid', type: 'string', required: true, description: 'Twilio Verify service SID' },
      ],
      outputSchema: [
        { name: 'status', type: 'string', required: true, description: 'Verification status' },
      ],
    },
  ],
};
