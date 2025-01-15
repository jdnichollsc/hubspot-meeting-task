/**
 * Base Processor Class
 * Contains common functionality for all HubSpot data processors
 */

const { hubspotClient, refreshAccessToken, getExpirationDate } = require('./hubspot-client');
const { generateLastModifiedDateFilter, saveDomain } = require('./utils');

class BaseProcessor {
  /**
   * @param {Object} domain - The domain object containing HubSpot integration details
   * @param {string} hubId - The HubSpot account ID
   * @param {Object} q - The queue for storing actions
   * @param {string} entityType - The type of entity being processed (e.g., 'companies', 'contacts', 'meetings')
   */
  constructor(domain, hubId, q, entityType) {
    this.domain = domain;
    this.hubId = hubId;
    this.q = q;
    this.entityType = entityType;
    this.account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
    this.lastPulledDate = new Date(this.account.lastPulledDates[entityType] || this.account.lastPulledDate);
    this.now = new Date();
    this.batchSize = 100;
  }

  /**
   * Fetches data from HubSpot API with retry logic
   * @param {Function} searchFn - The search function to execute
   * @param {Object} searchObject - The search parameters
   * @returns {Promise<Object>} The search results
   */
  async fetchWithRetry(searchFn, searchObject) {
    let tryCount = 0;
    while (tryCount <= 4) {
      try {
        const result = await searchFn(searchObject);
        return result;
      } catch (err) {
        tryCount++;
        if (this.shouldRefreshToken(err)) {
          await refreshAccessToken(this.domain, this.hubId);
        }
        if (tryCount <= 4) {
          await this.wait(tryCount);
        }
      }
    }
    throw new Error(`Failed to fetch ${this.entityType} for the 4th time. Aborting.`);
  }

  /**
   * Checks if token refresh is needed based on error
   * @param {Error} err - The error from HubSpot API
   * @returns {boolean}
   */
  shouldRefreshToken(err) {
    return new Date() > getExpirationDate() || (err.response && err.response.status === 401);
  }

  /**
   * Waits with exponential backoff
   * @param {number} tryCount - The current retry attempt
   * @returns {Promise<void>}
   */
  async wait(tryCount) {
    return new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(2, tryCount)));
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
    if (!offsetObject?.after) {
      return false;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
    return true;
  }

  /**
   * Updates the last pulled date and saves the domain
   * @returns {Promise<void>}
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