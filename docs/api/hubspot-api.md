# HubSpot API Integration

## Overview

This project integrates with HubSpot's CRM API to sync the following data:
- Companies
- Contacts
- Meetings

## API Endpoints Used

### Companies

```javascript
GET /crm/v3/objects/companies/search
```

Properties fetched:
- name
- domain
- country
- industry
- description
- annualrevenue
- numberofemployees
- hs_lead_status

### Contacts

```javascript
GET /crm/v3/objects/contacts/search
```

Properties fetched:
- firstname
- lastname
- jobtitle
- email
- hubspotscore
- hs_lead_status
- hs_analytics_source
- hs_latest_source

### Meetings

```javascript
GET /crm/v3/objects/meetings/search
```

Properties fetched:
- hs_meeting_title
- hs_meeting_body
- hs_meeting_start_time
- hs_meeting_end_time
- hs_timestamp

### Associations

```javascript
GET /crm/v3/associations/{objectType}/{toObjectType}/batch/read
POST /crm/v3/associations/{objectType}/{toObjectType}/batch/read
```

Used for:
- Contact to Company associations
- Meeting to Contact associations

## Authentication

The integration uses OAuth 2.0 for authentication:

1. Initial setup requires:
   - Client ID
   - Client Secret
   - Refresh Token

2. Token refresh flow:
   ```javascript
   POST /oauth/v1/token
   ```

## Rate Limiting

HubSpot implements rate limiting:
- Default: 100 requests per 10 seconds
- Handled via exponential backoff
- Maximum retry attempts: 4

## Error Handling

Common API errors and handling:

| Error Code | Description | Handling |
|------------|-------------|----------|
| 429 | Too Many Requests | Exponential backoff |
| 401 | Unauthorized | Refresh token |
| 404 | Not Found | Log and skip |
| 500 | Server Error | Retry with backoff |

## Data Sync Strategy

1. **Incremental Sync**
   - Track last sync date per object type
   - Only fetch modified records
   - Use `hs_lastmodifieddate` filter

2. **Batch Processing**
   - Fetch 100 records per request
   - Process associations in batches
   - Queue actions for bulk insert

3. **Error Recovery**
   - Implement retry mechanism
   - Log failed operations
   - Maintain sync state 