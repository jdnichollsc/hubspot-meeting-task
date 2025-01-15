const mockHubspotClient = {
  crm: {
    objects: {
      meetings: {
        searchApi: {
          doSearch: jest.fn().mockResolvedValue({
            results: [{
              id: 'meeting-1',
              properties: {
                hs_meeting_title: 'Test Meeting',
                hs_meeting_body: 'Meeting description',
                hs_meeting_start_time: '2024-01-15T10:00:00Z',
                hs_meeting_end_time: '2024-01-15T11:00:00Z'
              }
            }]
          })
        }
      }
    },
    companies: {
      searchApi: {
        doSearch: jest.fn().mockResolvedValue({
          results: [{
            id: 'company-1',
            properties: {
              domain: 'test-company.com',
              industry: 'Technology'
            }
          }]
        })
      }
    },
    contacts: {
      basicApi: {
        getById: jest.fn().mockResolvedValue({
          properties: {
            email: 'test@example.com',
            firstname: 'Test',
            lastname: 'User'
          }
        })
      },
      searchApi: {
        doSearch: jest.fn().mockResolvedValue({
          results: [{
            id: 'contact-1',
            properties: {
              email: 'test@company.com',
              firstname: 'Test',
              lastname: 'User',
              jobtitle: 'Developer'
            },
            createdAt: '2024-01-15T09:00:00Z'
          }]
        })
      }
    }
  },
  oauth: {
    tokensApi: {
      createToken: jest.fn().mockResolvedValue({
        accessToken: 'new-test-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      })
    }
  },
  apiRequest: jest.fn().mockImplementation(({ path }) => {
    if (path.includes('/associations/contacts')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          results: [{ id: 'contact-1' }]
        })
      });
    }
    return Promise.resolve({
      json: () => Promise.resolve({
        results: [{
          from: { id: 'contact-1' },
          to: [{ id: 'company-1' }]
        }]
      })
    });
  }),
  setAccessToken: jest.fn()
};

module.exports = {
  Client: jest.fn().mockImplementation(() => mockHubspotClient)
};
