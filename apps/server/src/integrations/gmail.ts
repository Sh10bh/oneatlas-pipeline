import type { Integration } from '../types/Integration';

export const gmailIntegration: Integration = {
  id: 'gmail',
  displayName: 'Gmail / Google Workspace',
  authType: 'oauth2',
  description: 'Send emails and create calendar events via Google Workspace',
  implemented: true,
  triggers: [
    {
      id: 'gmail.record_event',
      label: 'Record Event',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on any record event',
    },
  ],
  actions: [
    {
      id: 'send_email',
      label: 'Send Email',
      description: 'Send an email via Gmail',
      stubbed: false,
      inputSchema: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject line' },
        { name: 'body', type: 'string', required: true, description: 'Email body — supports HTML' },
        { name: 'cc', type: 'string', required: false, description: 'CC recipients comma separated' },
      ],
      outputSchema: [
        { name: 'messageId', type: 'string', required: true, description: 'Gmail message ID' },
        { name: 'threadId', type: 'string', required: true, description: 'Gmail thread ID' },
      ],
    },
    {
      id: 'create_calendar_event',
      label: 'Create Calendar Event',
      description: 'Create a Google Calendar event',
      stubbed: false,
      inputSchema: [
        { name: 'title', type: 'string', required: true, description: 'Event title' },
        { name: 'startTime', type: 'string', required: true, description: 'ISO 8601 start datetime' },
        { name: 'endTime', type: 'string', required: true, description: 'ISO 8601 end datetime' },
        { name: 'attendees', type: 'string', required: false, description: 'Comma-separated attendee emails' },
        { name: 'description', type: 'string', required: false, description: 'Event description' },
      ],
      outputSchema: [
        { name: 'eventId', type: 'string', required: true, description: 'Google Calendar event ID' },
        { name: 'htmlLink', type: 'string', required: true, description: 'Link to the event' },
      ],
    },
  ],
};
