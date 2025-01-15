/**
 * Base Processor Class
 * Contains common functionality for all HubSpot data processors
 */

const { refreshAccessToken } = require('./hubspot-client');
const { saveDomain, generateLastModifiedDateFilter } = require('./utils');

class BaseProcessor {
  /**
   * Initialize the base processor with common functionality
   * @param {Object} domain - The domain object containing integration settings
   * @param {string} hubId - The HubSpot account ID
   * @param {Object} hubspotClient - The HubSpot API client instance
   * @param {Object} q - The queue for processing actions
   * @param {string} entityType - The type of entity being processed
   */
  constructor(domain, hubId, hubspotClient, q, entityType) {
    this.domain = domain;
    this.hubId = hubId;
    this.client = hubspotClient;
    this.q = q;
    this.entityType = entityType;
    this.account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
    this.lastPulledDate = new Date(this.account.lastPulledDates[entityType] || this.account.lastPulledDate);
    this.now = new Date();
    this.batchSize = 100;
  }

  /**
   * Fetches data from HubSpot API with retry logic
   * @param {Function} apiCall - The HubSpot API call to execute
   * @returns {Promise<Object>} The API response
   */
  async fetchWithRetry(apiCall) {
    try {
      return await apiCall(this.client);
    } catch (error) {
      if (error.response && error.response.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.fetchWithRetry(apiCall);
      }
      if (error.response && error.response.status === 401) {
        await refreshAccessToken(this.domain, this.hubId);
        return this.fetchWithRetry(apiCall);
      }
      throw error;
    }
  }

  /**
   * Creates a search object for HubSpot API
   * @param {Object} offsetObject - The pagination offset
   * @param {string[]} properties - The properties to fetch
   * @param {string} [dateProperty='hs_lastmodifieddate'] - The date property to filter on
   * @returns {Object} The search object
   */
  createSearchObject(offsetObject, properties, dateProperty = 'hs_lastmodifieddate') {
    const lastModifiedDate = offsetObject.lastModifiedDate || this.lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(lastModifiedDate, this.now, dateProperty);

    return {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: dateProperty, direction: 'ASCENDING' }],
      properties,
      limit: this.batchSize,
      after: offsetObject.after
    };
  }

  /**
   * Handles pagination offset
   * @param {Object} offsetObject - The current offset object
   * @param {Array} data - The current batch of data
   * @returns {boolean} Whether there is more data to fetch
   */
  handlePagination(offsetObject, data) {
    // If no data or no next page, we're done
    if (!data.length || !offsetObject?.after) {
      return false;
    }
    // HubSpot's limit is 10,000 records per request
    if (offsetObject.after >= 9900) {
      // Reset pagination and use last record's date as new start date
      offsetObject.after = 0;
      const lastRecord = data[data.length - 1];
      offsetObject.lastModifiedDate = new Date(lastRecord.properties?.hs_lastmodifieddate || lastRecord.updatedAt).valueOf();
    }
    return true;
  }

  /**
   * Updates the last pulled date for the entity type
   */
  async updateLastPulledDate() {
    this.account.lastPulledDates[this.entityType] = this.now;
    await saveDomain(this.domain);
  }

  /**
   * Determines if a record is newly created
   * @param {Object} record - The record to check
   * @returns {boolean}
   */
  isNewRecord(record) {
    return !this.lastPulledDate || (new Date(record.createdAt) > this.lastPulledDate);
  }

  /**
   * Gets the action date for a record
   * @param {Object} record - The record to get date for
   * @param {boolean} isCreated - Whether the record is newly created
   * @returns {Date}
   */
  getActionDate(record, isCreated) {
    return new Date(isCreated ? record.createdAt : record.updatedAt);
  }
}

module.exports = BaseProcessor;
