# 🚀 5-Minute ngrok Setup

Get your GitVault ENS integration working in 5 minutes with ngrok!

## 🎯 Quick Steps:

### 1. Install ngrok
```bash
# Option 1: Download from https://ngrok.com/download
# Option 2: 
brew install ngrok/ngrok/ngrok  # macOS
npm install -g ngrok            # Any platform
```

### 2. Get auth token & setup
```bash
# Sign up at https://ngrok.com, get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 3. Start the ENS server
```bash
cd server
npm install
cp config.example.env .env
# Edit .env with your PRIVATE_KEY
npm run dev  # Server starts on localhost:3001
```

### 4. Start ngrok (new terminal)
```bash
ngrok http 3001
# Copy the https URL (e.g., https://abc123.ngrok.io)
```

### 5. Update GitHub Action
Edit `.github/workflows/upload-to-walrus.yml`:
```bash
ENS_SERVER_URL="https://abc123.ngrok.io"  # Your ngrok URL
```

### 6. Test!
Push to your repo and watch the magic happen! ✨

## 📖 For Detailed Guide
See `server/NGROK_SETUP.md` for complete instructions and troubleshooting.

## 🚀 Ready for Production?
When ready, deploy to Railway/Vercel and update the URL in the GitHub Action. 