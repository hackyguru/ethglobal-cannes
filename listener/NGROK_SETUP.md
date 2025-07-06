# 🚀 Quick ngrok Setup for Development

This guide shows how to use ngrok to test the ENS server before deploying to production.

## 📋 Prerequisites

- Node.js 18+
- Your contract owner private key
- Some ETH on Base Sepolia for gas fees

## ⚡ Quick Start (5 minutes)

### 1. Install ngrok
```bash
# Visit https://ngrok.com/download or:
brew install ngrok/ngrok/ngrok  # macOS
# or
npm install -g ngrok  # Any platform
```

### 2. Get ngrok auth token
```bash
# Sign up at https://ngrok.com
# Copy your auth token from dashboard
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### 3. Setup and start the server
```bash
cd server
npm install

# Create environment file
cp config.example.env .env

# Edit .env with your values:
# PRIVATE_KEY=your-contract-owner-private-key
# RPC_URL=https://sepolia.base.org
# CONTRACT_ADDRESS=0x1c10424bF8149F7cB10d1989679bfA6933799e4d

# Start the server
npm run dev
```

### 4. Start ngrok tunnel (new terminal)
```bash
ngrok http 3001
```

Copy the HTTPS URL from the output (e.g., `https://abc123.ngrok.io`)

### 5. Update GitHub Action
Edit `.github/workflows/upload-to-walrus.yml`:
```bash
ENS_SERVER_URL="https://abc123.ngrok.io"  # Your ngrok URL
```

### 6. Test it!
Push to your repository and watch the GitHub Action logs!

## 🔍 Testing Endpoints

Test your server locally:

```bash
# Health check
curl https://abc123.ngrok.io/health

# Test ENS update (replace with real values)
curl -X POST https://abc123.ngrok.io/api/update-ens \
  -H "Content-Type: application/json" \
  -d '{
    "label": "your-github-username",
    "repository": "test-repo",
    "cid": "test-blob-id"
  }'
```

## 🌐 ngrok Web Interface

Visit `http://localhost:4040` to see:
- Request/response logs
- Traffic inspection
- Request replay

## ⚠️ Important Notes

### Free Account Limitations:
- ✅ Perfect for testing
- ⚠️ URL changes when you restart ngrok
- ⚠️ 40 requests/minute limit
- ⚠️ Random subdomain (abc123.ngrok.io)

### For Production:
- 🚀 Deploy to Railway, Vercel, or DigitalOcean
- 🔒 Use custom domain
- 📈 No rate limits
- 🎯 Persistent URL

## 🛠️ Troubleshooting

**ngrok command not found?**
```bash
# Add to PATH or use full path
/usr/local/bin/ngrok http 3001
```

**Server not starting?**
```bash
# Check your .env file
cat .env

# Check if port 3001 is free
lsof -i :3001
```

**Transaction failing?**
```bash
# Check wallet balance
# Check private key is correct
# Check RPC URL is working
curl https://sepolia.base.org -X POST -H "Content-Type: application/json" -d '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}'
```

## 🎯 Production Migration

When ready for production:

1. **Deploy server** to Railway/Vercel/etc.
2. **Update GitHub Action** with production URL
3. **Stop ngrok** (no longer needed)

## 📝 Example .env File

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Blockchain Configuration
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x1234567890abcdef...  # Your contract owner private key
CONTRACT_ADDRESS=0x1c10424bF8149F7cB10d1989679bfA6933799e4d

# Optional
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

## 🎉 Success!

When everything works:
- ✅ GitHub Action uploads to Walrus
- ✅ Calls your ngrok server
- ✅ Server updates ENS text record
- ✅ Transaction confirmed on blockchain

Perfect for development and testing! 🚀 