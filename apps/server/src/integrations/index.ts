import { integrationRegistry } from './registry';
import { slackIntegration } from './integrations/slack';
import { stripeIntegration } from './integrations/stripe';
import { whatsappIntegration } from './integrations/whatsapp';
import { gmailIntegration } from './integrations/gmail';
import { jiraIntegration } from './integrations/jira';
import { githubIntegration } from './integrations/github';
import { hubspotIntegration } from './integrations/hubspot';
import { webhookIntegration } from './integrations/webhook';
import { notionIntegration } from './integrations/notion';
import { airtableIntegration } from './integrations/airtable';
import { salesforceIntegration } from './integrations/salesforce';
import { twilioSmsIntegration } from './integrations/twilio-sms';
import { zapierIntegration } from './integrations/zapier';
import { sheetsIntegration } from './integrations/sheets';

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
