import type { Integration } from '../types/Integration';

export const notionIntegration: Integration = {
  id: 'notion',
  displayName: 'Notion',
  authType: 'oauth2',
  description: 'Create pages and update database rows in Notion — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'notion.data_change',
      label: 'Data Change',
      entityEvents: ['created', 'updated'],
      description: 'Triggers on data change events',
    },
  ],
  actions: [
    {
      id: 'create_page',
      label: 'Create Page',
      description: 'Create a new Notion page — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'parentId', type: 'string', required: true, description: 'Parent page or database ID' },
        { name: 'title', type: 'string', required: true, description: 'Page title' },
        { name: 'content', type: 'json', required: false, description: 'Page content blocks' },
      ],
      outputSchema: [
        { name: 'pageId', type: 'string', required: true, description: 'Notion page ID' },
        { name: 'url', type: 'string', required: true, description: 'URL to the page' },
      ],
    },
    {
      id: 'update_database_row',
      label: 'Update Database Row',
      description: 'Update a row in a Notion database — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'pageId', type: 'string', required: true, description: 'Notion page ID to update' },
        { name: 'properties', type: 'json', required: true, description: 'Properties to update' },
      ],
      outputSchema: [
        { name: 'pageId', type: 'string', required: true, description: 'Updated page ID' },
      ],
    },
  ],
};
