# HubSpot Integration Service

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![HubSpot](https://img.shields.io/badge/HubSpot-FF7A59?style=for-the-badge&logo=hubspot&logoColor=white)

A robust Node.js service that synchronizes and processes data between HubSpot's CRM and your system. Built with scalability and reliability in mind, it handles company and contact data synchronization efficiently.

## 🚀 Key Features

- Real-time data synchronization with HubSpot CRM
- Smart handling of company and contact associations
- Efficient batch processing and queue management
- Built-in rate limiting and error resilience
- OAuth-based secure authentication
- Comprehensive logging and monitoring

## 🛠 Tech Stack

- **Backend**: Node.js
- **Database**: MongoDB
- **API**: HubSpot CRM API v3
- **Authentication**: OAuth 2.0
- **Queue**: In-memory batch processing

## 📖 Documentation

Comprehensive documentation is available in the [docs](docs) directory:
- [Getting Started Guide](docs/guides/getting-started.md)
- [Architecture Overview](docs/architecture/overview.md)
- [API Documentation](docs/api/hubspot-api.md)

## 🔧 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/hubspot-integration-service.git

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start the service
node app.js
```

## 📝 License

MIT

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. 