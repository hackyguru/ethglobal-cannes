# GitVault ENS Update Server

This server handles ENS text record updates for GitVault GitHub Actions. It provides a secure, centralized way to update ENS records without exposing private keys in GitHub Actions.

## 🚀 Features

- **Secure**: Private key stays on the server, never exposed
- **Automated**: Handles ENS updates from GitHub Actions
- **Validated**: Input validation and error handling
- **Rate Limited**: Protection against abuse
- **Monitored**: Health checks and logging

## 🏗️ Architecture

```
GitHub Action → Walrus Upload → ENS Server → Smart Contract → Blockchain
```

1. **GitHub Action** uploads codebase to Walrus
2. **GitHub Action** sends update request to ENS server
3. **ENS Server** validates and updates smart contract
4. **Smart Contract** stores text record on blockchain

## 📋 Prerequisites

- Node.js 18+ 
- Your contract owner private key
- Base Sepolia RPC access
- ETH for gas fees

## 🔧 Installation

### 1. Clone and Install
```bash
git clone <your-repo>
cd server
npm install
```

### 2. Configure Environment
```bash
cp config.example.env .env
```

Edit `.env` with your values:
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Blockchain Configuration
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your-private-key-here
CONTRACT_ADDRESS=0x1c10424bF8149F7cB10d1989679bfA6933799e4d
```

### 3. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

## 🌐 Deployment Options

### Option 0: ngrok (Quick Testing)
For quick testing and development:
```bash
# See NGROK_SETUP.md for detailed guide
ngrok http 3001
```
Perfect for testing before production deployment!

### Option 1: Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway deploy
```

### Option 2: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Option 3: DigitalOcean App Platform
1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy automatically

### Option 4: VPS/Docker
```bash
# Create Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]

# Build and run
docker build -t gitvault-ens-server .
docker run -p 3001:3001 --env-file .env gitvault-ens-server
```

## 🔒 Security Considerations

1. **Private Key Protection**:
   - Never commit private keys to version control
   - Use environment variables or secrets management
   - Consider using hardware wallets for production

2. **Rate Limiting**:
   - Default: 100 requests per 15 minutes per IP
   - Adjust based on your usage patterns

3. **Input Validation**:
   - All inputs are validated and sanitized
   - Only alphanumeric characters allowed in labels/repositories

4. **CORS**:
   - Configure CORS_ORIGIN for production
   - Default allows all origins (development only)

## 📊 API Endpoints

### `POST /api/update-ens`
Update ENS text record

**Request Body:**
```json
{
  "label": "github-username",
  "repository": "repository-name", 
  "cid": "walrus-blob-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "gasUsed": "150000",
    "label": "github-username",
    "repository": "repository-name",
    "cid": "walrus-blob-id"
  }
}
```

### `GET /api/get-record/:label/:repository`
Get ENS text record (for debugging)

**Response:**
```json
{
  "success": true,
  "data": {
    "label": "github-username",
    "repository": "repository-name",
    "value": "walrus-blob-id"
  }
}
```

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "wallet": "0x..."
}
```

## 🔧 GitHub Action Integration

Update the GitHub Action with your server URL:

1. Edit `.github/workflows/upload-to-walrus.yml`
2. Replace `https://your-ens-server.com` with your actual deployed server URL
3. Commit the changes - the GitHub Action will automatically use this URL

## 📈 Monitoring

### Logs
The server logs all operations:
- ENS update requests
- Transaction hashes and confirmations
- Errors and validation failures

### Health Check
Monitor server health:
```bash
curl https://your-server.com/health
```

### Gas Usage
Monitor gas usage and ensure wallet has sufficient funds:
- Typical gas usage: ~150,000 gas per update
- Current gas price: Check Base Sepolia

## 🚨 Troubleshooting

### Common Issues

1. **Insufficient Funds**:
   - Ensure wallet has ETH for gas fees
   - Monitor gas prices on Base Sepolia

2. **RPC Errors**:
   - Check RPC_URL is correct
   - Consider using Alchemy or Infura for better reliability

3. **Validation Errors**:
   - Ensure GitHub username contains only alphanumeric characters
   - Repository names should not contain special characters

4. **Rate Limiting**:
   - Reduce request frequency
   - Consider increasing rate limits for high-volume usage

### Debug Mode
Set `NODE_ENV=development` to see detailed error messages.

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |
| `RPC_URL` | Base Sepolia RPC | `https://sepolia.base.org` |
| `PRIVATE_KEY` | Contract owner private key | Required |
| `CONTRACT_ADDRESS` | ENS contract address | `0x1c10424bF8149F7cB10d1989679bfA6933799e4d` |
| `CORS_ORIGIN` | CORS allowed origins | `*` |
| `RATE_LIMIT_WINDOW` | Rate limit window (minutes) | `15` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

## 🔄 Updates

To update the server:
1. Pull latest changes
2. Run `npm install` for new dependencies
3. Restart the server
4. Check health endpoint

## 🆘 Support

For issues or questions:
1. Check server logs
2. Verify contract permissions
3. Test with the debug endpoint
4. Monitor gas prices and wallet balance 