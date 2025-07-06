# GitVault - Walrus Upload GitHub Action

This GitHub Action automatically uploads your entire codebase to Walrus as a structured JSON blob on every push to the repository. This format enables easy file previews and content access in frontend applications.

## How it works

The workflow (`/.github/workflows/upload-to-walrus.yml`) performs the following steps:

1. **Triggers on Push**: Activates whenever code is pushed to any branch
2. **Checkout Repository**: Downloads the complete repository content
3. **Create JSON Structure**: Creates a structured JSON containing all file contents and metadata
4. **Upload to Walrus**: Uploads the JSON to Walrus using the testnet API
5. **Report Status**: Displays success/failure status with blob ID and access URL

## API Configuration

The workflow uses the following Walrus API configuration:

- **Endpoint**: `https://publisher.walrus-testnet.walrus.space/v1/blobs`
- **Method**: PUT
- **Encoding**: RS2
- **Epochs**: 1 (stores for 1 epoch ahead of current)
- **Deletable**: false (permanent storage)
- **Force**: true (always creates new blob even if exists)

## What gets uploaded

The workflow creates a JSON structure containing:
- **File contents**: Text files as plain text, binary files as base64
- **File metadata**: Size, modification time, MIME type
- **Repository info**: Branch, commit hash, timestamp
- **Directory structure**: Preserved as JSON keys

**Included files**:
- All source code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`, etc.)
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- Documentation (`.md`, `.txt`)
- Small assets (< 1MB)

**Excluded from upload**:
- `.git` directory and `.github` workflows
- `node_modules` and build directories (`.next`, `dist`, `build`)
- Large files (> 1MB)
- Temporary files (`.log`, `.tmp`, `.cache`)
- System files (`.DS_Store`, `Thumbs.db`)
- Environment files (`.env`, `.env.local`)

## JSON Structure

The uploaded JSON blob has the following structure:

```json
{
  "metadata": {
    "timestamp": "2024-01-01T12:00:00Z",
    "repository": "username/repo-name",
    "branch": "main",
    "commit": "abc123...",
    "total_files": 25,
    "total_size": 150000
  },
  "files": {
    "README.md": {
      "content": "# My Project\n\nThis is my project...",
      "content_type": "text",
      "mime_type": "text/markdown",
      "size": 1024,
      "modified": "2024-01-01T11:30:00Z"
    },
    "package.json": {
      "content": "{\n  \"name\": \"my-project\",\n  ...",
      "content_type": "text",
      "mime_type": "application/json",
      "size": 2048,
      "modified": "2024-01-01T11:45:00Z"
    },
    "public/logo.png": {
      "content": "iVBORw0KGgoAAAANSUhEUgAA...",
      "content_type": "binary",
      "mime_type": "image/png",
      "size": 5120,
      "modified": "2024-01-01T10:00:00Z"
    }
  }
}
```

## ENS Text Record Integration

After uploading to Walrus, the workflow automatically updates the ENS text record:

1. **Extracts repository information**:
   - Label: GitHub username
   - Repository: Repository name
   - CID: Walrus blob ID

2. **Calls ENS update server**:
   - Server URL from GitHub secret: `ENS_SERVER_URL`
   - Contract: `0x1c10424bF8149F7cB10d1989679bfA6933799e4d`
   - Function: `updateTextRecord(label, repository, cid)`

3. **Real transaction execution**:
   - Server holds the private key securely
   - Transaction is executed and confirmed
   - Transaction hash is returned for verification

## Server Setup Required

To enable ENS updates, you need to:

1. **Deploy the ENS server** (see `/server/README.md`)
2. **Update the GitHub Action** with your server URL:
   - Edit `.github/workflows/upload-to-walrus.yml`
   - Replace `https://your-ens-server.com` with your actual server URL
3. **Update your contract** with the owner modification (see `/contracts/L2Registrar.sol`)

The server approach provides:
- ✅ **Security**: Private key never exposed to GitHub
- ✅ **Automation**: Real transactions on every push
- ✅ **Reliability**: Proper error handling and retries
- ✅ **Monitoring**: Transaction logs and health checks
- ✅ **Simplicity**: No GitHub secrets required

## Frontend Integration

### Option 1: Direct Walrus API
```javascript
const response = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`);
const codebaseData = await response.json();
```

### Option 2: Use the API Route (Recommended)
```javascript
// Get codebase overview
const response = await fetch(`/api/walrus/${blobId}`);
const result = await response.json();

if (result.success) {
  const { metadata, files, readmeContent } = result.data;
}

// Get specific file content
const fileResponse = await fetch(`/api/walrus/${blobId}?file=${encodeURIComponent(filePath)}`);
const fileResult = await fileResponse.json();
```

### Option 3: Use the React Component
```jsx
import WalrusCodebaseBrowser from '@/components/WalrusCodebaseBrowser';

function MyPage() {
  const blobId = "your-blob-id-here";
  
  return (
    <div>
      <WalrusCodebaseBrowser 
        blobId={blobId}
        className="w-full h-screen"
      />
    </div>
  );
}
```

## API Endpoints Created

### `/api/walrus/[blobId]`
- **GET** - Fetch codebase overview
- **GET** with `?file=path` - Fetch specific file content
- Returns structured JSON with file metadata and content
- Handles both text and binary files
- Automatic README detection

## Workflow Status

After each push, you can check the workflow status in the **Actions** tab of your GitHub repository. The workflow will:

- ✅ Show success with Walrus response details and blob ID
- ❌ Show failure with error details and HTTP status codes

## Response Handling

- **200**: Successful upload - blob stored on Walrus
- **400**: Malformed request
- **413**: Blob too large (reduce file inclusions)
- **451**: Blob blocked/cannot be returned
- **500**: Internal server error
- **504**: Timeout - retry needed

## Security Notes

- The workflow uses public Walrus testnet endpoints
- No sensitive data or secrets are required
- All uploads are handled over HTTPS
- Environment files (`.env`) are automatically excluded

## Customization

To modify the workflow behavior, edit `/.github/workflows/upload-to-walrus.yml`:

- **File size limit**: Change `1024 * 1024` to adjust max file size
- **Excluded files**: Modify the `should_exclude()` function
- **Storage duration**: Change `epochs` parameter
- **Branch triggers**: Adjust `on.push.branches` section

## Monitoring

Each workflow run provides:
- JSON size information and file count
- Upload response from Walrus with blob ID
- Direct access URL to the blob
- Repository metadata (branch, commit, timestamp)
- Success/failure status with detailed logging 