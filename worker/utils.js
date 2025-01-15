/**
 * Utilities Module
 * Contains helper functions for data filtering, domain management, and queue processing.
 * These utilities are used across the worker to handle common tasks.
 */

const { queue } = require('async');
const _ = require('lodash');
const { goal } = require('../utils');

/**
 * Generates a filter object for HubSpot API queries based on modification dates
 * Used to fetch only records that have been modified within a specific time range
 * 
 * @param {Date} date - The start date for the filter (usually last pulled date)
 * @param {Date} nowDate - The end date for the filter (usually current time)
 * @param {string} propertyName - The property to filter on (defaults to 'hs_lastmodifieddate')
 * @returns {Object} Filter object compatible with HubSpot's search API
 */
const generateLastModifiedDateFilter = (date, nowDate, propertyName = 'hs_lastmodifieddate') => {
  const lastModifiedDateFilter = date ?
    {
      filters: [
        { propertyName, operator: 'GTE', value: `${date.valueOf()}` },
        { propertyName, operator: 'LTE', value: `${nowDate.valueOf()}` }
      ]
    } :
    {};

  return lastModifiedDateFilter;
};

/**
 * Saves changes to the domain object
 * Ensures that HubSpot account changes are properly tracked and persisted
 * 
 * @param {Object} domain - The domain object to save
 * @returns {Promise<void>}
 */
const saveDomain = async domain => {
  domain.markModified('integrations.hubspot.accounts');
  await domain.save();
};

/**
 * Creates a queue for processing actions
 * The queue batches actions and sends them to the goal function when the batch size is reached
 * 
 * @param {Object} domain - The domain object containing API key
 * @param {Array} actions - Array to store the queued actions
 * @returns {Object} Queue instance with push and drain capabilities
 */
const createQueue = (domain, actions) => queue(async (action, callback) => {
  actions.push(action);

  if (actions.length > 2000) {
    console.log('inserting actions to database', { apiKey: domain.apiKey, count: actions.length });

    const copyOfActions = _.cloneDeep(actions);
    actions.splice(0, actions.length);

    goal(copyOfActions);
  }

  callback();
}, 100000000);

/**
 * Drains the queue and processes any remaining actions
 * Called when all data has been processed to ensure no actions are left in the queue
 * 
 * @param {Object} domain - The domain object
 * @param {Array} actions - Array containing the queued actions
 * @param {Object} q - The queue instance
 * @returns {Promise<boolean>} Resolves to true when queue is drained
 */
const drainQueue = async (domain, actions, q) => {
  if (q.length() > 0) await q.drain();

  if (actions.length > 0) {
    goal(actions)
  }

  return true;
};

module.exports = {
  generateLastModifiedDateFilter,
  saveDomain,
  createQueue,
  drainQueue
}; 