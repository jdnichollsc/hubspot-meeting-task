/**
 * HubSpot Client Module
 * Manages the HubSpot API client instance and token refresh functionality.
 * This module is responsible for maintaining the authentication state with HubSpot.
 */

const hubspot = require('@hubspot/api-client');

// Initialize HubSpot client with empty token - will be set later
let hubspotClient = new hubspot.Client({ accessToken: '' });

// Track token expiration time
let expirationDate;

/**
 * Sets the HubSpot client instance
 * Used primarily for testing to inject mock clients
 * @param {Object} client - The HubSpot client instance
 */
const setHubspotClient = (client) => {
  hubspotClient = client;
};

/**
 * Sets the token expiration date
 * Used primarily for testing to simulate token expiration
 * @param {Date} date - The expiration date to set
 */
const setExpirationDate = (date) => {
  expirationDate = date;
};

/**
 * Refreshes the HubSpot access token when it expires
 * Uses the refresh token to obtain a new access token
 * Updates the client and domain with the new token
 *
 * @param {Object} domain - The domain object containing HubSpot integration details
 * @param {string} hubId - The HubSpot account ID
 * @returns {Promise<boolean>} - Resolves to true if token refresh is successful
 */
const refreshAccessToken = async (domain, hubId) => {
  const { HUBSPOT_CID, HUBSPOT_CS } = process.env;
  const account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
  const { accessToken, refreshToken } = account;

  return hubspotClient.oauth.tokensApi
    .createToken('refresh_token', undefined, undefined, HUBSPOT_CID, HUBSPOT_CS, refreshToken)
    .then(async result => {
      const body = result.body ? result.body : result;

      const newAccessToken = body.accessToken;
      expirationDate = new Date(body.expiresIn * 1000 + new Date().getTime());

      hubspotClient.setAccessToken(newAccessToken);
      if (newAccessToken !== accessToken) {
        account.accessToken = newAccessToken;
      }

      return true;
    });
};

module.exports = {
  hubspotClient,
  setHubspotClient,
  setExpirationDate,
  refreshAccessToken,
  getExpirationDate: () => expirationDate
};
