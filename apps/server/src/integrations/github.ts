import type { Integration } from '../types/Integration';

export const githubIntegration: Integration = {
  id: 'github',
  displayName: 'GitHub',
  authType: 'api_key',
  description: 'Create issues, comment on PRs, and trigger GitHub Actions workflows',
  implemented: true,
  triggers: [
    {
      id: 'github.dev_workflow',
      label: 'Dev Workflow Trigger',
      entityEvents: ['created', 'updated', 'status_changed'],
      description: 'Triggers on development workflow events',
    },
  ],
  actions: [
    {
      id: 'create_issue',
      label: 'Create Issue',
      description: 'Create a GitHub issue in a repository',
      stubbed: false,
      inputSchema: [
        { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
        { name: 'repo', type: 'string', required: true, description: 'Repository name' },
        { name: 'title', type: 'string', required: true, description: 'Issue title' },
        { name: 'body', type: 'string', required: false, description: 'Issue body' },
        { name: 'labels', type: 'string', required: false, description: 'Comma-separated label names' },
        { name: 'assignees', type: 'string', required: false, description: 'Comma-separated GitHub usernames' },
      ],
      outputSchema: [
        { name: 'issueNumber', type: 'number', required: true, description: 'GitHub issue number' },
        { name: 'url', type: 'string', required: true, description: 'URL to the issue' },
      ],
    },
    {
      id: 'comment_on_pr',
      label: 'Comment on PR',
      description: 'Add a comment to a pull request',
      stubbed: false,
      inputSchema: [
        { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
        { name: 'repo', type: 'string', required: true, description: 'Repository name' },
        { name: 'pullNumber', type: 'number', required: true, description: 'Pull request number' },
        { name: 'body', type: 'string', required: true, description: 'Comment body' },
      ],
      outputSchema: [
        { name: 'commentId', type: 'number', required: true, description: 'Comment ID' },
        { name: 'url', type: 'string', required: true, description: 'URL to the comment' },
      ],
    },
    {
      id: 'trigger_workflow',
      label: 'Trigger Workflow Dispatch',
      description: 'Trigger a GitHub Actions workflow via workflow_dispatch',
      stubbed: false,
      inputSchema: [
        { name: 'owner', type: 'string', required: true, description: 'Repository owner' },
        { name: 'repo', type: 'string', required: true, description: 'Repository name' },
        { name: 'workflowId', type: 'string', required: true, description: 'Workflow file name or ID' },
        { name: 'ref', type: 'string', required: true, description: 'Branch or tag to run on' },
        { name: 'inputs', type: 'json', required: false, description: 'Workflow input parameters' },
      ],
      outputSchema: [
        { name: 'success', type: 'boolean', required: true, description: 'Whether dispatch succeeded' },
      ],
    },
  ],
};
