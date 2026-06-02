import type { Integration } from '../types/Integration';

export const stripeIntegration: Integration = {
  id: 'stripe',
  displayName: 'Stripe',
  authType: 'api_key',
  description: 'Handle payments, subscriptions, and customer management via Stripe',
  implemented: true,
  triggers: [
    {
      id: 'stripe.payment_event',
      label: 'Payment Event',
      entityEvents: ['created', 'updated'],
      description: 'Triggers on payment or subscription events',
    },
    {
      id: 'stripe.status_changed',
      label: 'Subscription Status Changed',
      entityEvents: ['status_changed'],
      description: 'Triggers when subscription status changes',
    },
  ],
  actions: [
    {
      id: 'create_customer',
      label: 'Create Customer',
      description: 'Create a new Stripe customer',
      stubbed: false,
      inputSchema: [
        { name: 'email', type: 'string', required: true, description: 'Customer email address' },
        { name: 'name', type: 'string', required: true, description: 'Customer full name' },
        { name: 'metadata', type: 'json', required: false, description: 'Additional metadata' },
      ],
      outputSchema: [
        { name: 'customerId', type: 'string', required: true, description: 'Stripe customer ID' },
      ],
    },
    {
      id: 'create_charge',
      label: 'Create Charge',
      description: 'Charge a customer',
      stubbed: false,
      inputSchema: [
        { name: 'customerId', type: 'string', required: true, description: 'Stripe customer ID' },
        { name: 'amount', type: 'number', required: true, description: 'Amount in smallest currency unit' },
        { name: 'currency', type: 'string', required: true, description: 'Three-letter currency code' },
        { name: 'description', type: 'string', required: false, description: 'Charge description' },
      ],
      outputSchema: [
        { name: 'chargeId', type: 'string', required: true, description: 'Stripe charge ID' },
        { name: 'status', type: 'string', required: true, description: 'Charge status' },
      ],
    },
    {
      id: 'create_subscription',
      label: 'Create Subscription',
      description: 'Create a subscription for a customer',
      stubbed: false,
      inputSchema: [
        { name: 'customerId', type: 'string', required: true, description: 'Stripe customer ID' },
        { name: 'priceId', type: 'string', required: true, description: 'Stripe price ID' },
      ],
      outputSchema: [
        { name: 'subscriptionId', type: 'string', required: true, description: 'Stripe subscription ID' },
        { name: 'status', type: 'string', required: true, description: 'Subscription status' },
      ],
    },
    {
      id: 'issue_refund',
      label: 'Issue Refund',
      description: 'Issue a refund for a charge',
      stubbed: false,
      inputSchema: [
        { name: 'chargeId', type: 'string', required: true, description: 'Stripe charge ID to refund' },
        { name: 'amount', type: 'number', required: false, description: 'Amount to refund — omit for full refund' },
      ],
      outputSchema: [
        { name: 'refundId', type: 'string', required: true, description: 'Stripe refund ID' },
        { name: 'status', type: 'string', required: true, description: 'Refund status' },
      ],
    },
  ],
};
