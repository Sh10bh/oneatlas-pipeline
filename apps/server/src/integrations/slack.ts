import type { Integration } from '../types/Integration';

export const slackIntegration: Integration = {
  id: 'slack',
  displayName: 'Slack',
  authType: 'oauth2',
  description: 'Send messages and notifications to Slack channels and users',
  implemented: true,
  triggers: [
    {
      id: 'slack.record_created',
      label: 'Record Created',
      entityEvents: ['created'],
      description: 'Triggers when a new record is created in the app',
    },
    {
      id: 'slack.record_updated',
      label: 'Record Updated',
      entityEvents: ['updated'],
      description: 'Triggers when a record is updated',
    },
    {
      id: 'slack.status_changed',
      label: 'Status Changed',
      entityEvents: ['status_changed'],
      description: 'Triggers when a record status changes',
    },
  ],
  actions: [
    {
      id: 'send_channel_message',
      label: 'Send Channel Message',
      description: 'Send a message to a Slack channel',
      stubbed: false,
      inputSchema: [
        { name: 'channel', type: 'string', required: true, description: 'Slack channel name or ID' },
        { name: 'message', type: 'string', required: true, description: 'Message text to send' },
        { name: 'username', type: 'string', required: false, description: 'Bot username override' },
      ],
      outputSchema: [
        { name: 'ts', type: 'string', required: true, description: 'Message timestamp' },
        { name: 'channel', type: 'string', required: true, description: 'Channel the message was sent to' },
      ],
    },
    {
      id: 'send_dm',
      label: 'Send Direct Message',
      description: 'Send a direct message to a Slack user',
      stubbed: false,
      inputSchema: [
        { name: 'userId', type: 'string', required: true, description: 'Slack user ID' },
        { name: 'message', type: 'string', required: true, description: 'Message text to send' },
      ],
      outputSchema: [
        { name: 'ts', type: 'string', required: true, description: 'Message timestamp' },
      ],
    },
    {
      id: 'post_block_message',
      label: 'Post Block Message',
      description: 'Post a richly formatted block message to a channel',
      stubbed: false,
      inputSchema: [
        { name: 'channel', type: 'string', required: true, description: 'Slack channel name or ID' },
        { name: 'blocks', type: 'json', required: true, description: 'Slack Block Kit JSON payload' },
        { name: 'fallbackText', type: 'string', required: true, description: 'Fallback plain text' },
      ],
      outputSchema: [
        { name: 'ts', type: 'string', required: true, description: 'Message timestamp' },
      ],
    },
  ],
};
