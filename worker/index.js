/**
 * HubSpot Worker Module
 * Main entry point for the HubSpot data synchronization worker.
 * Orchestrates the process of pulling and processing data from HubSpot,
 * including companies, contacts, and meetings.
 */

const Domain = require('../Domain');
const { refreshAccessToken } = require('./hubspot-client');
const { createQueue, drainQueue } = require('./utils');
const { processCompanies, processContacts, processMeetings } = require('./processors');

/**
 * Main function to pull and process data from HubSpot
 * Handles multiple HubSpot accounts within a domain
 * Creates actions for all updated records since the last sync
 * 
 * Process flow:
 * 1. Find the domain
 * 2. For each HubSpot account:
 *    - Refresh access token
 *    - Process contacts and their company associations
 *    - Process companies
 *    - Process meetings and their attendees
 *    - Drain the action queue
 * 
 * @returns {Promise<void>}
 */
const pullDataFromHubspot = async () => {
  console.log('start pulling data from HubSpot');

  const domain = await Domain.findOne({});

  for (const account of domain.integrations.hubspot.accounts) {
    console.log('start processing account');

    // Refresh access token for the account
    try {
      await refreshAccessToken(domain, account.hubId);
    } catch (err) {
      console.log(err, { apiKey: domain.apiKey, metadata: { operation: 'refreshAccessToken' } });
    }

    // Initialize action queue
    const actions = [];
    const q = createQueue(domain, actions);

    // Process contacts (includes company associations)
    try {
      await processContacts(domain, account.hubId, q);
      console.log('process contacts');
    } catch (err) {
      console.log(err, { apiKey: domain.apiKey, metadata: { operation: 'processContacts', hubId: account.hubId } });
    }

    // Process companies
    try {
      await processCompanies(domain, account.hubId, q);
      console.log('process companies');
    } catch (err) {
      console.log(err, { apiKey: domain.apiKey, metadata: { operation: 'processCompanies', hubId: account.hubId } });
    }

    // Process meetings
    try {
      await processMeetings(domain, account.hubId, q);
      console.log('process meetings');
    } catch (err) {
      console.log(err, { apiKey: domain.apiKey, metadata: { operation: 'processMeetings', hubId: account.hubId } });
    }

    // Process remaining actions in the queue
    try {
      await drainQueue(domain, actions, q);
      console.log('drain queue');
    } catch (err) {
      console.log(err, { apiKey: domain.apiKey, metadata: { operation: 'drainQueue', hubId: account.hubId } });
    }

    console.log('finish processing account');
  }

  process.exit();
};

/**
 * Worker entry point
 * Initializes and starts the HubSpot data synchronization process
 * 
 * @returns {Promise<void>}
 */
module.exports = async function startWorker() {
  try {
    console.log('Starting HubSpot worker...');
    await pullDataFromHubspot();
  } catch (error) {
    console.error('Error in worker:', error);
  }
};

// Export functions for testing
module.exports.pullDataFromHubspot = pullDataFromHubspot;
module.exports.setHubspotClient = require('./hubspot-client').setHubspotClient;
module.exports.setExpirationDate = require('./hubspot-client').setExpirationDate;
module.exports.processCompanies = processCompanies;
module.exports.processContacts = processContacts;
module.exports.processMeetings = processMeetings; 