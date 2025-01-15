# HubSpot Integration Service

## Overview

This service integrates with HubSpot's CRM API to synchronize company and contact data. It's designed to run as a background worker that periodically pulls data from HubSpot and processes it for our system.

### What it Does
- Pulls and processes company data from HubSpot
- Synchronizes contact information and their company associations
- Creates actions for data changes (Created/Updated events)
- Handles data relationships and associations efficiently
- Manages OAuth authentication and token refresh
- Implements smart retry mechanisms for API rate limits

### Key Features
- **Incremental Sync**: Only fetches recently modified data
- **Batch Processing**: Handles data in chunks of 100 records
- **Association Handling**: Maintains relationships between contacts and companies
- **Queue-Based Actions**: Buffers and processes actions in batches
- **Error Resilience**: Implements exponential backoff for API limits

## Tech Stack

- **Runtime**: Node.js
- **Database**: MongoDB
- **External API**: HubSpot CRM API
- **Architecture**: Event-driven with queue-based processing

## Quick Start

1. **Prerequisites**
   ```bash
   # Check Node.js version
   node --version  # Should be v14 or higher
   ```

2. **Installation**
   ```bash
   # Install dependencies
   npm install
   
   # Setup environment
   npm run setup
   ```

3. **Configuration**
   - Open `.env` file and fill in:
     - HubSpot credentials
     - MongoDB connection string
     - Other required environment variables

4. **Running the Service**
   ```bash
   # Start the application
   npm start
   
   # Run the worker service
   npm run worker
   
   # Run tests
   npm test                  # Run all tests
   npm run test:watch        # Run tests in watch mode
   npm run test:coverage     # Run tests with coverage report
   
   # Linting
   npm run lint             # Check code style
   npm run lint:fix         # Fix code style issues automatically
   ```

## Project Structure

```
├── app.js          # Application entry point
├── worker.js       # HubSpot data sync worker
├── server.js       # API server (not primary focus)
├── Domain.js       # Data models and schema
├── utils.js        # Helper functions
└── docs/           # Detailed documentation
```

## Key Concepts

### Data Flow
1. Worker fetches modified data from HubSpot
2. Processes companies and contacts
3. Handles associations between contacts and companies
4. Queues actions for processing
5. Batches data for database operations

### HubSpot Integration
- Uses OAuth for authentication
- Handles rate limiting with exponential backoff
- Processes data in batches of 100 records
- Manages associations between different object types

### Domain Model
The `Domain` model represents a customer in our system:
```javascript
{
  integrations: {
    hubspot: {
      accounts: [{
        hubId: String,
        accessToken: String,
        refreshToken: String,
        // ... other properties
      }]
    }
  }
}
```

## Common Pitfalls

1. **API Rate Limits**: HubSpot has rate limits. The worker implements backoff strategies.
2. **Token Expiration**: OAuth tokens need periodic refresh.
3. **Data Processing Time**: Operations should complete within 5 seconds.

## Detailed Documentation

For in-depth information about:
- Architecture diagrams
- API documentation
- Setup guides
- Best practices

Please check our [Detailed Documentation](docs/README.md).

## Development Guidelines

1. **Error Handling**
   - Always implement retries with backoff
   - Log errors with context
   - Handle API failures gracefully

2. **Data Processing**
   - Process data in batches
   - Validate data before processing
   - Handle missing or malformed data

3. **Testing**
   - Test with rate limits in mind
   - Verify error handling
   - Check data transformation logic

## Troubleshooting

1. **Service Won't Start**
   - Check Node.js version
   - Verify environment variables
   - Ensure MongoDB is running

2. **Data Sync Issues**
   - Check HubSpot credentials
   - Verify API access
   - Look for rate limiting errors

3. **Performance Problems**
   - Monitor batch sizes
   - Check database indexes
   - Verify network connectivity

## Need Help?

1. Check the [Documentation](docs/README.md)
2. Review error logs
3. Contact the maintainers

