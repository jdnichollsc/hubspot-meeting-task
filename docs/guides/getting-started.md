# Getting Started

This guide will help you set up and run the HubSpot Integration project locally.

## Prerequisites

- Node.js (version specified in package.json)
- MongoDB
- HubSpot Developer Account
- Git

## Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd api-sample-test-master
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file:
```bash
cp .env.example .env
```

## Environment Setup

Configure the following environment variables in your `.env` file:

```env
HUBSPOT_CID=your_client_id
HUBSPOT_CS=your_client_secret
MONGODB_URI=your_mongodb_connection_string
```

## Running the Application

1. Start the application:
```bash
node app.js
```

2. Run the data sync worker:
```bash
node worker.js
```

## Project Structure

```
├── app.js              # Main application entry point
├── worker.js           # HubSpot data sync worker
├── server.js           # API server implementation
├── Domain.js           # Domain model definition
└── utils.js            # Utility functions
```

## Development Workflow

1. Create a new branch for your feature/fix
2. Make your changes
3. Run tests (if available)
4. Submit a pull request

## Troubleshooting

Common issues and their solutions:

1. **HubSpot API Rate Limits**: The worker implements exponential backoff
2. **MongoDB Connection**: Ensure your MongoDB instance is running
3. **Access Token**: Make sure your HubSpot credentials are valid 