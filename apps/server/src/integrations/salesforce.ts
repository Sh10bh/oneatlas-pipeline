import type { Integration } from '../types/Integration';

export const salesforceIntegration: Integration = {
  id: 'salesforce',
  displayName: 'Salesforce',
  authType: 'oauth2',
  description: 'Sync CRM entities with Salesforce — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'salesforce.crm_sync',
      label: 'CRM Entity Synced',
      entityEvents: ['created', 'updated'],
      description: 'Triggers when a CRM entity is synced',
    },
  ],
  actions: [
    {
      id: 'create_lead',
      label: 'Create Lead',
      description: 'Create a Salesforce Lead — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'firstName', type: 'string', required: true, description: 'Lead first name' },
        { name: 'lastName', type: 'string', required: true, description: 'Lead last name' },
        { name: 'email', type: 'string', required: true, description: 'Lead email' },
        { name: 'company', type: 'string', required: true, description: 'Lead company' },
      ],
      outputSchema: [
        { name: 'leadId', type: 'string', required: true, description: 'Salesforce lead ID' },
      ],
    },
    {
      id: 'update_opportunity',
      label: 'Update Opportunity',
      description: 'Update a Salesforce Opportunity — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'opportunityId', type: 'string', required: true, description: 'Opportunity ID' },
        { name: 'stage', type: 'string', required: false, description: 'New opportunity stage' },
        { name: 'amount', type: 'number', required: false, description: 'Deal amount' },
      ],
      outputSchema: [
        { name: 'opportunityId', type: 'string', required: true, description: 'Updated opportunity ID' },
      ],
    },
  ],
};
