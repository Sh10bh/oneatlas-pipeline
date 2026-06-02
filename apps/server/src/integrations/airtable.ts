import type { Integration } from '../types/Integration';

export const airtableIntegration: Integration = {
  id: 'airtable',
  displayName: 'Airtable',
  authType: 'api_key',
  description: 'Create and update Airtable records — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'airtable.record_event',
      label: 'Record Event',
      entityEvents: ['created', 'updated', 'deleted'],
      description: 'Triggers on record events',
    },
  ],
  actions: [
    {
      id: 'create_record',
      label: 'Create Record',
      description: 'Create a new Airtable record — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'baseId', type: 'string', required: true, description: 'Airtable base ID' },
        { name: 'tableId', type: 'string', required: true, description: 'Airtable table ID' },
        { name: 'fields', type: 'json', required: true, description: 'Record fields as key-value pairs' },
      ],
      outputSchema: [
        { name: 'recordId', type: 'string', required: true, description: 'Airtable record ID' },
      ],
    },
    {
      id: 'update_field',
      label: 'Update Field',
      description: 'Update a field in an Airtable record — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'baseId', type: 'string', required: true, description: 'Airtable base ID' },
        { name: 'tableId', type: 'string', required: true, description: 'Airtable table ID' },
        { name: 'recordId', type: 'string', required: true, description: 'Record ID to update' },
        { name: 'fields', type: 'json', required: true, description: 'Fields to update' },
      ],
      outputSchema: [
        { name: 'recordId', type: 'string', required: true, description: 'Updated record ID' },
      ],
    },
  ],
};
