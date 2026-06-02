import type { Integration } from '../types/Integration';

export const hubspotIntegration: Integration = {
  id: 'hubspot',
  displayName: 'HubSpot',
  authType: 'oauth2',
  description: 'Sync contacts, deals, and sequences with HubSpot CRM',
  implemented: true,
  triggers: [
    {
      id: 'hubspot.contact_event',
      label: 'Contact or Deal Event',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on contact or deal events',
    },
  ],
  actions: [
    {
      id: 'create_contact',
      label: 'Create Contact',
      description: 'Create a new HubSpot contact',
      stubbed: false,
      inputSchema: [
        { name: 'email', type: 'string', required: true, description: 'Contact email' },
        { name: 'firstName', type: 'string', required: false, description: 'First name' },
        { name: 'lastName', type: 'string', required: false, description: 'Last name' },
        { name: 'phone', type: 'string', required: false, description: 'Phone number' },
        { name: 'company', type: 'string', required: false, description: 'Company name' },
      ],
      outputSchema: [
        { name: 'contactId', type: 'string', required: true, description: 'HubSpot contact ID' },
      ],
    },
    {
      id: 'update_deal_stage',
      label: 'Update Deal Stage',
      description: 'Move a HubSpot deal to a new pipeline stage',
      stubbed: false,
      inputSchema: [
        { name: 'dealId', type: 'string', required: true, description: 'HubSpot deal ID' },
        { name: 'stageId', type: 'string', required: true, description: 'Pipeline stage ID' },
      ],
      outputSchema: [
        { name: 'dealId', type: 'string', required: true, description: 'Updated deal ID' },
        { name: 'stage', type: 'string', required: true, description: 'New stage name' },
      ],
    },
    {
      id: 'add_to_sequence',
      label: 'Add to Sequence',
      description: 'Enroll a contact in a HubSpot email sequence',
      stubbed: false,
      inputSchema: [
        { name: 'contactId', type: 'string', required: true, description: 'HubSpot contact ID' },
        { name: 'sequenceId', type: 'string', required: true, description: 'HubSpot sequence ID' },
      ],
      outputSchema: [
        { name: 'enrollmentId', type: 'string', required: true, description: 'Sequence enrollment ID' },
      ],
    },
  ],
};
