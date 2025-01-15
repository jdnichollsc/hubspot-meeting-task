const mongoose = require('mongoose');
const { Schema } = mongoose;

// Mock the actual Domain schema structure
const DomainSchema = new Schema({
  customers: [{
    customerId: {
      type: String, // Using String instead of ObjectId for testing
      ref: 'Customer'
    },
    mailPreferences: {
      type: Object,
      default: {}
    }
  }],
  company: {
    type: String, // Using String instead of ObjectId for testing
    ref: 'Company'
  },
  apiKey: String,
  integrations: {
    hubspot: {
      accounts: [{
        hubId: String,
        lastPulledDates: {
          meetings: Date,
          contacts: Date,
          companies: Date
        },
        accessToken: String,
        refreshToken: String
      }]
    }
  }
});

// Mock instance methods if needed
DomainSchema.methods = {
  // Add any instance methods here
};

// Create a mock Domain model
const Domain = mongoose.model('Domain', DomainSchema);

// Create a mock domain instance
const mockDomain = {
  apiKey: 'test-api-key',
  customers: [],
  company: null,
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

// Mock the static methods
Domain.findOne = jest.fn().mockResolvedValue(mockDomain);

module.exports = Domain; 