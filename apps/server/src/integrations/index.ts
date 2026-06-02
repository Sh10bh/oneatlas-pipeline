import { integrationRegistry } from './registry';
import { slackIntegration } from './slack';
import { stripeIntegration } from './stripe';
import { whatsappIntegration } from './whatsapp';
import { gmailIntegration } from './gmail';
import { jiraIntegration } from './jira';
import { githubIntegration } from './github';
import { hubspotIntegration } from './hubspot';
import { webhookIntegration } from './webhook';
import { notionIntegration } from './notion';
import { airtableIntegration } from './airtable';
import { salesforceIntegration } from './salesforce';
import { twilioSmsIntegration } from './twilio-sms';
import { zapierIntegration } from './zapier';
import { sheetsIntegration } from './sheets';

// Register all integrations — 8 implemented + 6 stubbed
integrationRegistry.register(slackIntegration);
integrationRegistry.register(stripeIntegration);
integrationRegistry.register(whatsappIntegration);
integrationRegistry.register(gmailIntegration);
integrationRegistry.register(jiraIntegration);
integrationRegistry.register(githubIntegration);
integrationRegistry.register(hubspotIntegration);
integrationRegistry.register(webhookIntegration);
integrationRegistry.register(notionIntegration);
integrationRegistry.register(airtableIntegration);
integrationRegistry.register(salesforceIntegration);
integrationRegistry.register(twilioSmsIntegration);
integrationRegistry.register(zapierIntegration);
integrationRegistry.register(sheetsIntegration);

export { integrationRegistry };
