import type { Integration } from '../types/Integration';

export const sheetsIntegration: Integration = {
  id: 'google_sheets',
  displayName: 'Google Sheets',
  authType: 'oauth2',
  description: 'Append rows and update cells in Google Sheets — STUBBED',
  implemented: false,
  triggers: [
    {
      id: 'sheets.data_export',
      label: 'Data Export Event',
      entityEvents: ['created', 'updated'],
      description: 'Triggers on data export events',
    },
  ],
  actions: [
    {
      id: 'append_row',
      label: 'Append Row',
      description: 'Append a row to a Google Sheet — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'spreadsheetId', type: 'string', required: true, description: 'Google Sheets spreadsheet ID' },
        { name: 'range', type: 'string', required: true, description: 'Sheet range e.g. Sheet1!A:Z' },
        { name: 'values', type: 'json', required: true, description: 'Array of values to append' },
      ],
      outputSchema: [
        { name: 'updatedRange', type: 'string', required: true, description: 'Range that was updated' },
        { name: 'updatedRows', type: 'number', required: true, description: 'Number of rows added' },
      ],
    },
    {
      id: 'update_cell',
      label: 'Update Cell',
      description: 'Update a specific cell — STUBBED: HTTP call not implemented',
      stubbed: true,
      inputSchema: [
        { name: 'spreadsheetId', type: 'string', required: true, description: 'Spreadsheet ID' },
        { name: 'range', type: 'string', required: true, description: 'Cell range e.g. Sheet1!A1' },
        { name: 'value', type: 'string', required: true, description: 'Value to write' },
      ],
      outputSchema: [
        { name: 'updatedRange', type: 'string', required: true, description: 'Range that was updated' },
      ],
    },
  ],
};
