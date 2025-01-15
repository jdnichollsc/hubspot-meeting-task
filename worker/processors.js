/**
 * Data Processors Module
 * Contains processor classes for different types of HubSpot data.
 * Each processor extends BaseProcessor for common functionality.
 */

const { hubspotClient } = require('./hubspot-client');
const { filterNullValuesFromObject } = require('../utils');
const BaseProcessor = require('./base-processor');

class CompanyProcessor extends BaseProcessor {
  constructor(domain, hubId, q) {
    super(domain, hubId, q, 'companies');
    this.properties = [
      'name',
      'domain',
      'country',
      'industry',
      'description',
      'annualrevenue',
      'numberofemployees',
      'hs_lead_status'
    ];
  }

  /**
   * Creates an action for a company
   * @param {Object} company - The company data
   * @returns {void}
   */
  createAction(company) {
    if (!company.properties) return;

    const isCreated = this.isNewRecord(company);
    const actionTemplate = {
      includeInAnalytics: 0,
      companyProperties: {
        company_id: company.id,
        company_domain: company.properties.domain,
        company_industry: company.properties.industry
      }
    };

    this.q.push({
      actionName: isCreated ? 'Company Created' : 'Company Updated',
      actionDate: this.getActionDate(company, isCreated),
      ...actionTemplate
    });
  }

  /**
   * Processes all companies
   * @returns {Promise<boolean>}
   */
  async process() {
    let hasMore = true;
    const offsetObject = {};

    while (hasMore) {
      const searchObject = this.createSearchObject(offsetObject, this.properties);
      const searchResult = await this.fetchWithRetry(
        searchObj => hubspotClient.crm.companies.searchApi.doSearch(searchObj),
        searchObject
      );

      const data = searchResult?.results || [];
      offsetObject.after = parseInt(searchResult?.paging?.next?.after);

      console.log('fetch company batch');
      data.forEach(company => this.createAction(company));
      hasMore = this.handlePagination(offsetObject, data);
    }

    await this.updateLastPulledDate();
    return true;
  }
}

class ContactProcessor extends BaseProcessor {
  constructor(domain, hubId, q) {
    super(domain, hubId, q, 'contacts');
    this.properties = [
      'firstname',
      'lastname',
      'jobtitle',
      'email',
      'hubspotscore',
      'hs_lead_status',
      'hs_analytics_source',
      'hs_latest_source'
    ];
  }

  /**
   * Fetches company associations for contacts
   * @param {string[]} contactIds - Array of contact IDs
   * @returns {Promise<Object>} Map of contact ID to company ID
   */
  async fetchCompanyAssociations(contactIds) {
    const result = await hubspotClient.apiRequest({
      method: 'post',
      path: '/crm/v3/associations/CONTACTS/COMPANIES/batch/read',
      body: { inputs: contactIds.map(contactId => ({ id: contactId })) }
    });

    const associations = (await result.json())?.results || [];
    return Object.fromEntries(
      associations
        .map(a => a.from ? [a.from.id, a.to[0].id] : false)
        .filter(Boolean)
    );
  }

  /**
   * Creates an action for a contact
   * @param {Object} contact - The contact data
   * @param {Object} companyAssociations - Map of contact ID to company ID
   * @returns {void}
   */
  createAction(contact, companyAssociations) {
    if (!contact.properties?.email) return;

    const isCreated = this.isNewRecord(contact);
    const userProperties = {
      company_id: companyAssociations[contact.id],
      contact_name: ((contact.properties.firstname || '') + ' ' + (contact.properties.lastname || '')).trim(),
      contact_title: contact.properties.jobtitle,
      contact_source: contact.properties.hs_analytics_source,
      contact_status: contact.properties.hs_lead_status,
      contact_score: parseInt(contact.properties.hubspotscore) || 0
    };

    this.q.push({
      actionName: isCreated ? 'Contact Created' : 'Contact Updated',
      actionDate: this.getActionDate(contact, isCreated),
      includeInAnalytics: 0,
      identity: contact.properties.email,
      userProperties: filterNullValuesFromObject(userProperties)
    });
  }

  /**
   * Processes all contacts
   * @returns {Promise<boolean>}
   */
  async process() {
    let hasMore = true;
    const offsetObject = {};

    while (hasMore) {
      const searchObject = this.createSearchObject(offsetObject, this.properties, 'lastmodifieddate');
      const searchResult = await this.fetchWithRetry(
        searchObj => hubspotClient.crm.contacts.searchApi.doSearch(searchObj),
        searchObject
      );

      const data = searchResult?.results || [];
      offsetObject.after = parseInt(searchResult?.paging?.next?.after);

      console.log('fetch contact batch');
      const contactIds = data.map(contact => contact.id);
      const companyAssociations = await this.fetchCompanyAssociations(contactIds);
      
      data.forEach(contact => this.createAction(contact, companyAssociations));
      hasMore = this.handlePagination(offsetObject, data);
    }

    await this.updateLastPulledDate();
    return true;
  }
}

class MeetingProcessor extends BaseProcessor {
  constructor(domain, hubId, q) {
    super(domain, hubId, q, 'meetings');
    this.properties = [
      'hs_meeting_title',
      'hs_meeting_body',
      'hs_meeting_start_time',
      'hs_meeting_end_time',
      'hs_timestamp',
      'hs_meeting_outcome'
    ];
  }

  /**
   * Fetches attendees for a meeting
   * @param {string} meetingId - The meeting ID
   * @returns {Promise<Array>} Array of attendee IDs
   */
  async fetchAttendees(meetingId) {
    const result = await hubspotClient.apiRequest({
      method: 'get',
      path: `/crm/v3/objects/meetings/${meetingId}/associations/contacts`
    });
    return (await result.json())?.results || [];
  }

  /**
   * Fetches contact details for an attendee
   * @param {string} contactId - The contact ID
   * @returns {Promise<Object>} Contact details
   */
  async fetchContactDetails(contactId) {
    return hubspotClient.crm.contacts.basicApi.getById(contactId, ['email']);
  }

  /**
   * Creates an action for a meeting attendee
   * @param {Object} meeting - The meeting data
   * @param {Object} contact - The contact data
   * @returns {void}
   */
  createAction(meeting, contact) {
    if (!contact?.properties?.email) return;

    const isCreated = this.isNewRecord(meeting);
    const actionTemplate = {
      includeInAnalytics: 0,
      identity: contact.properties.email,
      meetingProperties: {
        meeting_id: meeting.id,
        meeting_title: meeting.properties.hs_meeting_title,
        meeting_start_time: meeting.properties.hs_meeting_start_time,
        meeting_end_time: meeting.properties.hs_meeting_end_time,
        meeting_outcome: meeting.properties.hs_meeting_outcome
      }
    };

    this.q.push({
      actionName: isCreated ? 'Meeting Created' : 'Meeting Updated',
      actionDate: this.getActionDate(meeting, isCreated),
      ...actionTemplate
    });
  }

  /**
   * Processes all meetings
   * @returns {Promise<boolean>}
   */
  async process() {
    let hasMore = true;
    const offsetObject = {};

    while (hasMore) {
      const searchObject = this.createSearchObject(offsetObject, this.properties);
      const searchResult = await this.fetchWithRetry(
        searchObj => hubspotClient.crm.objects.meetings.searchApi.doSearch(searchObj),
        searchObject
      );

      const data = searchResult?.results || [];
      offsetObject.after = parseInt(searchResult?.paging?.next?.after);

      console.log('fetch meeting batch');

      for (const meeting of data) {
        if (!meeting.properties) continue;

        const attendees = await this.fetchAttendees(meeting.id);
        for (const attendee of attendees) {
          const contact = await this.fetchContactDetails(attendee.id);
          this.createAction(meeting, contact);
        }
      }

      hasMore = this.handlePagination(offsetObject, data);
    }

    await this.updateLastPulledDate();
    return true;
  }
}

// Export processor functions that maintain the same interface
module.exports = {
  processCompanies: (domain, hubId, q) => new CompanyProcessor(domain, hubId, q).process(),
  processContacts: (domain, hubId, q) => new ContactProcessor(domain, hubId, q).process(),
  processMeetings: (domain, hubId, q) => new MeetingProcessor(domain, hubId, q).process()
}; 