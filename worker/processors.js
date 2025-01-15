/**
 * Data Processors Module
 * Contains functions for processing different types of HubSpot data (companies, contacts, meetings).
 * Each processor handles pagination, error retries, and action creation for its data type.
 */

const { hubspotClient, refreshAccessToken, getExpirationDate } = require('./hubspot-client');
const { generateLastModifiedDateFilter, saveDomain } = require('./utils');
const { filterNullValuesFromObject } = require('../utils');

/**
 * Processes company data from HubSpot
 * Fetches and processes companies in batches, creating appropriate actions for new or updated companies
 * 
 * @param {Object} domain - The domain object containing HubSpot integration details
 * @param {string} hubId - The HubSpot account ID
 * @param {Object} q - The queue for storing actions
 * @returns {Promise<boolean>} - Resolves to true when all companies are processed
 */
const processCompanies = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.companies);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = 100; // Maximum batch size for HubSpot API

  while (hasMore) {
    // Generate search parameters for the current batch
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(lastModifiedDate, now);
    const searchObject = {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
      properties: [
        'name',
        'domain',
        'country',
        'industry',
        'description',
        'annualrevenue',
        'numberofemployees',
        'hs_lead_status'
      ],
      limit,
      after: offsetObject.after
    };

    // Fetch companies with retry logic
    let searchResult = {};
    let tryCount = 0;
    while (tryCount <= 4) {
      try {
        searchResult = await hubspotClient.crm.companies.searchApi.doSearch(searchObject);
        break;
      } catch (err) {
        tryCount++;
        if (new Date() > getExpirationDate()) await refreshAccessToken(domain, hubId);
        await new Promise((resolve, reject) => setTimeout(resolve, 5000 * Math.pow(2, tryCount)));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch companies for the 4th time. Aborting.');

    const data = searchResult?.results || [];
    offsetObject.after = parseInt(searchResult?.paging?.next?.after);

    console.log('fetch company batch');

    // Process each company in the batch
    data.forEach(company => {
      if (!company.properties) return;

      const actionTemplate = {
        includeInAnalytics: 0,
        companyProperties: {
          company_id: company.id,
          company_domain: company.properties.domain,
          company_industry: company.properties.industry
        }
      };

      const isCreated = !lastPulledDate || (new Date(company.createdAt) > lastPulledDate);

      q.push({
        actionName: isCreated ? 'Company Created' : 'Company Updated',
        actionDate: new Date(isCreated ? company.createdAt : company.updatedAt) - 2000,
        ...actionTemplate
      });
    });

    // Handle pagination
    if (!offsetObject?.after) {
      hasMore = false;
      break;
    } else if (offsetObject?.after >= 9900) {
      // HubSpot limitation: offset cannot exceed 10,000
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
  }

  account.lastPulledDates.companies = now;
  await saveDomain(domain);

  return true;
};

/**
 * Processes contact data from HubSpot
 * Fetches and processes contacts in batches, including their company associations
 * Creates appropriate actions for new or updated contacts
 * 
 * @param {Object} domain - The domain object containing HubSpot integration details
 * @param {string} hubId - The HubSpot account ID
 * @param {Object} q - The queue for storing actions
 * @returns {Promise<boolean>} - Resolves to true when all contacts are processed
 */
const processContacts = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.contacts);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = 100;

  while (hasMore) {
    // Generate search parameters for the current batch
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(lastModifiedDate, now, 'lastmodifieddate');
    const searchObject = {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: 'lastmodifieddate', direction: 'ASCENDING' }],
      properties: [
        'firstname',
        'lastname',
        'jobtitle',
        'email',
        'hubspotscore',
        'hs_lead_status',
        'hs_analytics_source',
        'hs_latest_source'
      ],
      limit,
      after: offsetObject.after
    };

    // Fetch contacts with retry logic
    let searchResult = {};
    let tryCount = 0;
    while (tryCount <= 4) {
      try {
        searchResult = await hubspotClient.crm.contacts.searchApi.doSearch(searchObject);
        break;
      } catch (err) {
        tryCount++;
        if (new Date() > getExpirationDate()) await refreshAccessToken(domain, hubId);
        await new Promise((resolve, reject) => setTimeout(resolve, 5000 * Math.pow(2, tryCount)));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch contacts for the 4th time. Aborting.');

    const data = searchResult.results || [];
    console.log('fetch contact batch');

    offsetObject.after = parseInt(searchResult.paging?.next?.after);
    const contactIds = data.map(contact => contact.id);

    // Fetch company associations for the contacts
    const contactsToAssociate = contactIds;
    const companyAssociationsResults = (await (await hubspotClient.apiRequest({
      method: 'post',
      path: '/crm/v3/associations/CONTACTS/COMPANIES/batch/read',
      body: { inputs: contactsToAssociate.map(contactId => ({ id: contactId })) }
    })).json())?.results || [];

    // Process company associations
    const companyAssociations = Object.fromEntries(companyAssociationsResults.map(a => {
      if (a.from) {
        contactsToAssociate.splice(contactsToAssociate.indexOf(a.from.id), 1);
        return [a.from.id, a.to[0].id];
      } else return false;
    }).filter(x => x));

    // Process each contact in the batch
    data.forEach(contact => {
      if (!contact.properties || !contact.properties.email) return;

      const companyId = companyAssociations[contact.id];
      const isCreated = new Date(contact.createdAt) > lastPulledDate;

      const userProperties = {
        company_id: companyId,
        contact_name: ((contact.properties.firstname || '') + ' ' + (contact.properties.lastname || '')).trim(),
        contact_title: contact.properties.jobtitle,
        contact_source: contact.properties.hs_analytics_source,
        contact_status: contact.properties.hs_lead_status,
        contact_score: parseInt(contact.properties.hubspotscore) || 0
      };

      const actionTemplate = {
        includeInAnalytics: 0,
        identity: contact.properties.email,
        userProperties: filterNullValuesFromObject(userProperties)
      };

      q.push({
        actionName: isCreated ? 'Contact Created' : 'Contact Updated',
        actionDate: new Date(isCreated ? contact.createdAt : contact.updatedAt),
        ...actionTemplate
      });
    });

    // Handle pagination
    if (!offsetObject?.after) {
      hasMore = false;
      break;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
  }

  account.lastPulledDates.contacts = now;
  await saveDomain(domain);

  return true;
};

/**
 * Processes meeting data from HubSpot
 * Fetches and processes meetings in batches, including attendee information
 * Creates appropriate actions for new or updated meetings
 * 
 * @param {Object} domain - The domain object containing HubSpot integration details
 * @param {string} hubId - The HubSpot account ID
 * @param {Object} q - The queue for storing actions
 * @returns {Promise<boolean>} - Resolves to true when all meetings are processed
 */
const processMeetings = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(account => account.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.meetings || account.lastPulledDate);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = 100;

  while (hasMore) {
    // Generate search parameters for the current batch
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const lastModifiedDateFilter = generateLastModifiedDateFilter(lastModifiedDate, now);
    const searchObject = {
      filterGroups: [lastModifiedDateFilter],
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
      properties: [
        'hs_meeting_title',
        'hs_meeting_body',
        'hs_meeting_start_time',
        'hs_meeting_end_time',
        'hs_timestamp',
        'hs_meeting_outcome'
      ],
      limit,
      after: offsetObject.after
    };

    // Fetch meetings with retry logic
    let searchResult = {};
    let tryCount = 0;
    while (tryCount <= 4) {
      try {
        searchResult = await hubspotClient.crm.objects.meetings.searchApi.doSearch(searchObject);
        break;
      } catch (err) {
        tryCount++;
        if (new Date() > getExpirationDate() || (err.response && err.response.status === 401)) {
          await refreshAccessToken(domain, hubId);
        }
        await new Promise((resolve, reject) => setTimeout(resolve, 5000 * Math.pow(2, tryCount)));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch meetings for the 4th time. Aborting.');

    const data = searchResult?.results || [];
    offsetObject.after = parseInt(searchResult?.paging?.next?.after);

    console.log('fetch meeting batch');

    // Process each meeting in the batch
    for (const meeting of data) {
      if (!meeting.properties) continue;

      // Get meeting attendees (contacts)
      const attendeesResult = await hubspotClient.apiRequest({
        method: 'get',
        path: `/crm/v3/objects/meetings/${meeting.id}/associations/contacts`
      });
      
      const attendees = (await attendeesResult.json())?.results || [];
      
      // Process each attendee
      for (const attendee of attendees) {
        const contactId = attendee.id;
        const contactResult = await hubspotClient.crm.contacts.basicApi.getById(
          contactId,
          ['email']
        );
        
        if (!contactResult?.properties?.email) continue;

        const actionTemplate = {
          includeInAnalytics: 0,
          identity: contactResult.properties.email,
          meetingProperties: {
            meeting_id: meeting.id,
            meeting_title: meeting.properties.hs_meeting_title,
            meeting_start_time: meeting.properties.hs_meeting_start_time,
            meeting_end_time: meeting.properties.hs_meeting_end_time,
            meeting_outcome: meeting.properties.hs_meeting_outcome
          }
        };

        const isCreated = !lastPulledDate || (new Date(meeting.createdAt) > lastPulledDate);

        q.push({
          actionName: isCreated ? 'Meeting Created' : 'Meeting Updated',
          actionDate: new Date(isCreated ? meeting.createdAt : meeting.updatedAt),
          ...actionTemplate
        });
      }
    }

    // Handle pagination
    if (!offsetObject?.after) {
      hasMore = false;
      break;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
  }

  account.lastPulledDates.meetings = now;
  await saveDomain(domain);

  return true;
};

module.exports = {
  processCompanies,
  processContacts,
  processMeetings
}; 