// Mock environment variables
process.env.HUBSPOT_CID = 'test-client-id';
process.env.HUBSPOT_CS = 'test-client-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

// Mock mongoose
const mockMongoose = {
  Schema: function () {
    return {
      add: jest.fn()
    };
  },
  model: jest.fn(),
  connect: jest.fn(),
  Types: {
    ObjectId: String,
    String,
    Number,
    Boolean,
    Date,
    Mixed: Object,
    Array
  }
};

mockMongoose.Schema.Types = mockMongoose.Types;

jest.mock('mongoose', () => mockMongoose);

// Mock async
jest.mock('async', () => ({
  queue: (callback) => ({
    push: (task, cb) => {
      callback(task);
      cb();
    },
    drain: () => {}
  })
}));

// Mock utils
jest.mock('../utils', () => ({
  filterNullValuesFromObject: obj => obj,
  goal: jest.fn()
}));

// Mock HubSpot client
const mockHubspotClient = {
  crm: {
    objects: {
      meetings: {
        searchApi: {
          doSearch: jest.fn().mockResolvedValue({ results: [] })
        }
      },
      companies: {
        searchApi: {
          doSearch: jest.fn().mockResolvedValue({ results: [] })
        }
      }
    },
    contacts: {
      basicApi: {
        getById: jest.fn().mockResolvedValue({ properties: { email: 'test@example.com' } })
      },
      searchApi: {
        doSearch: jest.fn().mockResolvedValue({ results: [] })
      }
    }
  },
  oauth: {
    tokensApi: {
      createToken: jest.fn().mockResolvedValue({
        access_token: 'new-test-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      })
    }
  },
  apiRequest: jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ results: [] })
  }),
  setAccessToken: jest.fn()
};

jest.mock('@hubspot/api-client', () => ({
  Client: jest.fn().mockImplementation(() => mockHubspotClient)
}));
