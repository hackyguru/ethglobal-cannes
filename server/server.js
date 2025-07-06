const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Trust proxy for ngrok and other proxies
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  trustProxy: true // Explicitly trust proxy for rate limiting
});
app.use('/api/', limiter);

// Contract configuration
const CONTRACT_ADDRESS = '0x1c10424bF8149F7cB10d1989679bfA6933799e4d';
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "label", "type": "string" },
      { "internalType": "string", "name": "repository", "type": "string" },
      { "internalType": "string", "name": "cid", "type": "string" }
    ],
    "name": "updateTextRecord",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "label", "type": "string" }
    ],
    "name": "available",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "label", "type": "string" },
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "addr", "type": "address" }
    ],
    "name": "register",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Blockchain setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// Validation middleware
const validateUpdateRequest = [
  body('label')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Label must be alphanumeric with underscores and hyphens only'),
  body('repository')
    .trim()
    .isLength({ min: 1, max: 200 })
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Repository must be alphanumeric with underscores, hyphens, and dots only'),
  body('cid')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('CID must be alphanumeric with underscores and hyphens only'),
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    wallet: wallet.address
  });
});

// Update ENS text record endpoint
app.post('/api/update-ens', validateUpdateRequest, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { label, repository, cid } = req.body;

    console.log(`📝 Updating ENS text record:`);
    console.log(`  Label: ${label}`);
    console.log(`  Repository: ${repository}`);
    console.log(`  CID: ${cid}`);

    // Check if subdomain exists first
    console.log(`🔍 Checking if subdomain '${label}' exists...`);
    const isAvailable = await contract.available(label);
    
    if (isAvailable) {
      console.log(`❌ Subdomain '${label}' is not registered yet!`);
      return res.status(400).json({
        success: false,
        error: `Subdomain '${label}' is not registered. Please register it first in your frontend app.`,
        details: {
          label,
          available: true,
          suggestion: `Go to your GitVault dashboard and register the subdomain '${label}' first.`
        }
      });
    }

    console.log(`✅ Subdomain '${label}' exists, proceeding with update...`);

    // Estimate gas
    const gasEstimate = await contract.updateTextRecord.estimateGas(label, repository, cid);
    console.log(`⛽ Gas estimate: ${gasEstimate.toString()}`);

    // Send transaction
    const tx = await contract.updateTextRecord(label, repository, cid, {
      gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
    });

    console.log(`🚀 Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);

    res.json({
      success: true,
      data: {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        label,
        repository,
        cid
      }
    });

  } catch (error) {
    console.error('❌ Error updating ENS text record:', error);
    
    // Handle specific error types
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    let details = process.env.NODE_ENV === 'development' ? error.message : undefined;

    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Insufficient funds for gas fees';
      statusCode = 503;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error - please try again';
      statusCode = 503;
    } else if (error.code === 'CALL_EXCEPTION') {
      errorMessage = 'Contract call failed - subdomain may not exist or you may not have permission';
      statusCode = 400;
      details = `Contract error: ${error.shortMessage || error.message}`;
    } else if (error.reason) {
      errorMessage = error.reason;
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details
    });
  }
});

// Register subdomain endpoint
app.post('/api/register-subdomain', [
  body('label')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Label must be alphanumeric with underscores and hyphens only'),
  body('ownerAddress')
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Owner address must be a valid Ethereum address'),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { label, ownerAddress } = req.body;

    console.log(`📝 Registering subdomain:`);
    console.log(`  Label: ${label}`);
    console.log(`  Owner: ${ownerAddress}`);

    // Check if subdomain is available
    const isAvailable = await contract.available(label);
    
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        error: `Subdomain '${label}' is already registered`,
        details: { label, available: false }
      });
    }

    // Register the subdomain
    const tx = await contract.register(label, ownerAddress, ownerAddress);
    console.log(`🚀 Registration transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Subdomain registered in block: ${receipt.blockNumber}`);

    res.json({
      success: true,
      data: {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        label,
        ownerAddress
      }
    });

  } catch (error) {
    console.error('❌ Error registering subdomain:', error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    let details = process.env.NODE_ENV === 'development' ? error.message : undefined;

    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Insufficient funds for gas fees';
      statusCode = 503;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error - please try again';
      statusCode = 503;
    } else if (error.code === 'CALL_EXCEPTION') {
      errorMessage = 'Contract call failed during registration';
      statusCode = 400;
      details = `Contract error: ${error.shortMessage || error.message}`;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details
    });
  }
});

// Get text records endpoint (for debugging)
app.get('/api/get-record/:label/:repository', async (req, res) => {
  try {
    const { label, repository } = req.params;
    
    // Create read-only contract instance
    const readOnlyContract = new ethers.Contract(
      CONTRACT_ADDRESS, 
      [
        {
          "inputs": [
            { "internalType": "string", "name": "label", "type": "string" },
            { "internalType": "string", "name": "key", "type": "string" }
          ],
          "name": "getTextRecord",
          "outputs": [
            { "internalType": "string", "name": "value", "type": "string" }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ], 
      provider
    );

    const value = await readOnlyContract.getTextRecord(label, repository);

    res.json({
      success: true,
      data: {
        label,
        repository,
        value
      }
    });

  } catch (error) {
    console.error('❌ Error getting text record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get text record',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GitVault ENS Server running on port ${PORT}`);
  console.log(`📝 Contract address: ${CONTRACT_ADDRESS}`);
  console.log(`🔑 Wallet address: ${wallet.address}`);
  console.log(`🌐 RPC URL: ${process.env.RPC_URL || 'https://sepolia.base.org'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Shutting down gracefully');
  process.exit(0);
}); 