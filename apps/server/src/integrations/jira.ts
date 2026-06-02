import type { Integration } from '../types/Integration';

export const jiraIntegration: Integration = {
  id: 'jira',
  displayName: 'Jira',
  authType: 'api_key',
  description: 'Create and manage Jira issues, track task status',
  implemented: true,
  triggers: [
    {
      id: 'jira.task_event',
      label: 'Task / Issue Event',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on task or issue events',
    },
  ],
  actions: [
    {
      id: 'create_issue',
      label: 'Create Issue',
      description: 'Create a new Jira issue',
      stubbed: false,
      inputSchema: [
        { name: 'projectKey', type: 'string', required: true, description: 'Jira project key e.g. ENG' },
        { name: 'summary', type: 'string', required: true, description: 'Issue summary/title' },
        { name: 'description', type: 'string', required: false, description: 'Issue description' },
        { name: 'issueType', type: 'string', required: true, description: 'Issue type e.g. Task, Bug, Story' },
        { name: 'assignee', type: 'string', required: false, description: 'Assignee account ID' },
        { name: 'priority', type: 'string', required: false, description: 'Priority level' },
      ],
      outputSchema: [
        { name: 'issueId', type: 'string', required: true, description: 'Jira issue ID' },
        { name: 'issueKey', type: 'string', required: true, description: 'Jira issue key e.g. ENG-42' },
        { name: 'url', type: 'string', required: true, description: 'URL to the issue' },
      ],
    },
    {
      id: 'update_status',
      label: 'Update Issue Status',
      description: 'Transition a Jira issue to a new status',
      stubbed: false,
      inputSchema: [
        { name: 'issueKey', type: 'string', required: true, description: 'Jira issue key' },
        { name: 'transitionId', type: 'string', required: true, description: 'Jira transition ID for new status' },
      ],
      outputSchema: [
        { name: 'success', type: 'boolean', required: true, description: 'Whether transition succeeded' },
      ],
    },
    {
      id: 'add_comment',
      label: 'Add Comment',
      description: 'Add a comment to a Jira issue',
      stubbed: false,
      inputSchema: [
        { name: 'issueKey', type: 'string', required: true, description: 'Jira issue key' },
        { name: 'body', type: 'string', required: true, description: 'Comment body text' },
      ],
      outputSchema: [
        { name: 'commentId', type: 'string', required: true, description: 'Comment ID' },
      ],
    },
    {
      id: 'assign_user',
      label: 'Assign User',
      description: 'Assign a Jira issue to a user',
      stubbed: false,
      inputSchema: [
        { name: 'issueKey', type: 'string', required: true, description: 'Jira issue key' },
        { name: 'accountId', type: 'string', required: true, description: 'Jira user account ID' },
      ],
      outputSchema: [
        { name: 'success', type: 'boolean', required: true, description: 'Whether assignment succeeded' },
      ],
    },
  ],
};
