const worker = require('../worker');
const hubspot = require('@hubspot/api-client');

// Increase Jest timeout for all tests
jest.setTimeout(30000);

// Mock the utils module
jest.mock('../utils', () => ({
  filterNullValuesFromObject: obj => obj,
  goal: jest.fn()
}));

describe('HubSpot Data Processing', () => {
  let mockHubspotClient;
  let mockDomain;
  let mockQueue;
  let actions;
  let realDate;

  beforeEach(() => {
    jest.useFakeTimers();
    realDate = global.Date;

    actions = [];
    mockQueue = {
      push: jest.fn((action) => actions.push(action)),
      drain: jest.fn().mockResolvedValue(true),
      length: () => actions.length
    };

    mockDomain = {
      apiKey: 'test-api-key',
      integrations: {
        hubspot: {
          accounts: [{
            hubId: 'test-hub-id',
            lastPulledDates: {
              meetings: new Date('2024-01-01'),
              contacts: new Date('2024-01-01'),
              companies: new Date('2024-01-01')
            },
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token'
          }]
        }
      },
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
    };

    mockHubspotClient = new hubspot.Client({ accessToken: 'test-token' });
    worker.setHubspotClient(mockHubspotClient);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
    global.Date = realDate;
  });

  describe('Token Management', () => {
    test('should refresh access token when expired', async () => {
      // Mock current date to be after token expiration
      const mockDate = new Date('2024-01-15T12:00:00Z');
      global.Date = class extends Date {
        constructor() {
          return mockDate;
        }

        static now() {
          return mockDate.getTime();
        }
      };

      // Set an expired token in the worker
      worker.setExpirationDate(new Date('2024-01-15T11:00:00Z')); // 1 hour ago

      const mockDomainWithExpiredToken = {
        ...mockDomain,
        integrations: {
          hubspot: {
            accounts: [{
              hubId: 'test-hub-id',
              accessToken: 'expired-token',
              refreshToken: 'test-refresh-token',
              lastPulledDates: {
                meetings: new Date('2024-01-01')
              }
            }]
          }
        }
      };

      // Mock token expired error and subsequent success
      const tokenError = new Error('Token expired');
      tokenError.response = { status: 401 };

      mockHubspotClient.crm.objects.meetings.searchApi.doSearch
        .mockRejectedValueOnce(tokenError)
        .mockResolvedValueOnce({
          results: [{
            id: 'meeting-1',
            properties: {
              hs_meeting_title: 'Test Meeting'
            }
          }]
        });

      // Mock successful token refresh
      mockHubspotClient.oauth.tokensApi.createToken.mockResolvedValueOnce({
        accessToken: 'new-test-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      });

      // Execute and advance timers
      const processPromise = worker.processMeetings(mockDomainWithExpiredToken, 'test-hub-id', mockQueue);

      // Advance timers multiple times to handle all async operations
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(5000);
        await Promise.resolve(); // Let any pending promises resolve
      }

      await processPromise;

      // Verify token refresh was called
      expect(mockHubspotClient.oauth.tokensApi.createToken).toHaveBeenCalledWith(
        'refresh_token',
        undefined,
        undefined,
        process.env.HUBSPOT_CID,
        process.env.HUBSPOT_CS,
        'test-refresh-token'
      );
      expect(mockHubspotClient.setAccessToken).toHaveBeenCalledWith('new-test-token');
    });
  });

  describe('Contact Processing', () => {
    test('should process contacts with company associations', async () => {
      const mockContact = {
        id: 'contact-1',
        properties: {
          email: 'test@company.com',
          firstname: 'Test',
          lastname: 'User',
          jobtitle: 'Developer'
        },
        createdAt: '2024-01-15T09:00:00Z'
      };

      mockHubspotClient.crm.contacts.searchApi.doSearch.mockResolvedValue({
        results: [mockContact]
      });

      mockHubspotClient.apiRequest.mockResolvedValue({
        json: () => Promise.resolve({
          results: [{
            from: { id: 'contact-1' },
            to: [{ id: 'company-1' }]
          }]
        })
      });

      await worker.processContacts(mockDomain, 'test-hub-id', mockQueue);
      jest.runAllTimers();

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        actionName: 'Contact Created',
        identity: 'test@company.com',
        userProperties: {
          company_id: 'company-1',
          contact_name: 'Test User',
          contact_title: 'Developer'
        }
      });
    });
  });

  describe('Meeting Processing', () => {
    test('should process new meetings and create appropriate actions', async () => {
      const mockMeeting = {
        id: 'meeting-1',
        properties: {
          hs_meeting_title: 'Test Meeting',
          hs_meeting_body: 'Meeting description',
          hs_meeting_start_time: '2024-01-15T10:00:00Z',
          hs_meeting_end_time: '2024-01-15T11:00:00Z'
        },
        createdAt: '2024-01-15T09:00:00Z'
      };

      // Mock meeting search response
      mockHubspotClient.crm.objects.meetings.searchApi.doSearch.mockResolvedValue({
        results: [mockMeeting]
      });

      // Mock meeting attendees response
      mockHubspotClient.apiRequest.mockImplementation(({ path }) => {
        if (path.includes('/associations/contacts')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              results: [{ id: 'contact-1' }]
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve({ results: [] })
        });
      });

      // Mock contact details response
      mockHubspotClient.crm.contacts.basicApi.getById.mockResolvedValue({
        properties: {
          email: 'test@example.com'
        }
      });

      // Execute and advance timers
      const processPromise = worker.processMeetings(mockDomain, 'test-hub-id', mockQueue);

      // Advance timers multiple times to handle all async operations
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Let any pending promises resolve
      }

      await processPromise;

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        actionName: 'Meeting Created',
        identity: 'test@example.com',
        meetingProperties: {
          meeting_id: 'meeting-1',
          meeting_title: 'Test Meeting'
        }
      });
    });
  });

  describe('Company Processing', () => {
    test('should process new companies and create appropriate actions', async () => {
      const mockCompany = {
        id: 'company-1',
        properties: {
          domain: 'test-company.com',
          industry: 'Technology'
        },
        createdAt: '2024-01-15T09:00:00Z'
      };

      // Mock the companies search API
      mockHubspotClient.crm.companies = {
        searchApi: {
          doSearch: jest.fn().mockResolvedValue({
            results: [mockCompany]
          })
        }
      };

      await worker.processCompanies(mockDomain, 'test-hub-id', mockQueue);
      jest.runAllTimers();

      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        actionName: 'Company Created',
        companyProperties: {
          company_id: 'company-1',
          company_domain: 'test-company.com',
          company_industry: 'Technology'
        }
      });
    });
  });
});
