import { createPublicClient, http, Address, encodePacked, keccak256 } from 'viem'
import { mainnet, baseSepolia } from 'wagmi/chains'

// Base Sepolia reverse registrar address
export const BASE_SEPOLIA_REVERSE_REGISTRAR = '0x00000BeEF055f7934784D6d81b6BC86665630dbA' as const

// Validator address for testnet signatures
export const VALIDATOR_ADDRESS = '0xAe91c512BC1da8B00cd33dd9D9C734069e6E0fcd' as const

// Function signatures for L2 reverse registrar
export const FUNCTION_SIGNATURES = {
  setNameForAddrWithSignature: '0x2023a04c',
  setNameForOwnableWithSignature: '0x975713ad',
} as const

// ABI for the reverse registrar nameForAddr() function
export const REVERSE_REGISTRAR_ABI = [
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'nameForAddr',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ABI for setting primary names on L2 reverse registrar
export const REVERSE_REGISTRAR_WRITE_ABI = [
  {
    inputs: [{ name: 'name', type: 'string' }],
    name: 'setName',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'name', type: 'string' }
    ],
    name: 'setNameForAddr',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'addr', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'coinTypes', type: 'uint256[]' },
      { name: 'signatureExpiry', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    name: 'setNameForAddrWithSignature',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddr', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'coinTypes', type: 'uint256[]' },
      { name: 'signatureExpiry', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    name: 'setNameForOwnableWithSignature',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Create public clients with explicit configuration
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum.publicnode.com'),
})

export const baseSepoliaClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

/**
 * Verify we're using the correct network client
 */
export const verifyBaseSepoliaNetwork = async (): Promise<{ chainId: number; isCorrect: boolean }> => {
  try {
    const chainId = await baseSepoliaClient.getChainId()
    const isCorrect = chainId === baseSepolia.id
    
    console.log(`Base Sepolia Client - Chain ID: ${chainId}, Expected: ${baseSepolia.id}, Correct: ${isCorrect}`)
    
    return { chainId, isCorrect }
  } catch (error) {
    console.error('Error verifying Base Sepolia network:', error)
    return { chainId: 0, isCorrect: false }
  }
}

/**
 * Check if the L2 reverse registrar contract exists
 */
export const checkL2ContractExists = async (): Promise<boolean> => {
  try {
    // First verify we're on the correct network
    const networkCheck = await verifyBaseSepoliaNetwork()
    if (!networkCheck.isCorrect) {
      console.warn(`Network mismatch: Using chain ${networkCheck.chainId}, expected ${baseSepolia.id}`)
    }
    
    const bytecode = await baseSepoliaClient.getCode({
      address: BASE_SEPOLIA_REVERSE_REGISTRAR,
    })
    
    const exists = bytecode !== undefined && bytecode !== '0x'
    console.log(`L2 Contract exists: ${exists}, Address: ${BASE_SEPOLIA_REVERSE_REGISTRAR}, Chain: ${networkCheck.chainId}`)
    
    return exists
  } catch (error) {
    console.warn('Unable to check L2 contract existence:', error)
    return false
  }
}

/**
 * Resolve L2 primary name from Base Sepolia reverse registrar
 */
export const resolveL2PrimaryName = async (address: Address): Promise<string | null> => {
  try {
    // Verify network first
    const networkCheck = await verifyBaseSepoliaNetwork()
    console.log(`Resolving L2 name for ${address} on chain ${networkCheck.chainId}`)
    
    // First check if the contract exists
    const contractExists = await checkL2ContractExists()
    if (!contractExists) {
      console.warn('L2 reverse registrar contract not found on Base Sepolia')
      return null
    }

    const result = await baseSepoliaClient.readContract({
      address: BASE_SEPOLIA_REVERSE_REGISTRAR,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: 'nameForAddr',
      args: [address],
    })
    
    console.log(`L2 name resolution result for ${address}:`, result)
    
    return result && result.length > 0 ? result : null
  } catch (error: any) {
    // Handle different types of errors
    if (error.message?.includes('execution reverted')) {
      console.info('No L2 primary name set for address:', address)
      return null
    }
    if (error.message?.includes('contract does not exist')) {
      console.warn('L2 reverse registrar contract not deployed on Base Sepolia')
      return null
    }
    
    console.error('Error resolving L2 primary name:', error)
    return null
  }
}

/**
 * Generate signature data for setNameForAddrWithSignature
 */
export const generateSignatureData = (
  name: string,
  addr: Address,
  coinTypes: bigint[],
  signatureExpiry: bigint
): `0x${string}` => {
  // Pack the signature data according to the format
  const packed = encodePacked(
    ['address', 'bytes4', 'string', 'address', 'uint256[]', 'uint256'],
    [
      VALIDATOR_ADDRESS,
      FUNCTION_SIGNATURES.setNameForAddrWithSignature as `0x${string}`,
      name,
      addr,
      coinTypes,
      signatureExpiry,
    ]
  )
  
  console.log('Generated signature data:', {
    validator: VALIDATOR_ADDRESS,
    functionSig: FUNCTION_SIGNATURES.setNameForAddrWithSignature,
    name,
    addr,
    coinTypes: coinTypes.map(c => c.toString()),
    expiry: signatureExpiry.toString(),
    packed
  })
  
  return keccak256(packed)
}

/**
 * Create signature expiry (1 hour from now)
 */
export const createSignatureExpiry = (): bigint => {
  const now = Math.floor(Date.now() / 1000)
  const oneHour = 60 * 60
  return BigInt(now + oneHour)
}

/**
 * Format address for display
 */
export const formatAddress = (address: string | undefined | null): string => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Check if an address is a valid Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Check if a string is a valid ENS name
 */
export const isValidEnsName = (name: string): boolean => {
  // Basic ENS name validation - should end with .eth or other valid TLD
  return /^[a-zA-Z0-9-_]+\.(eth|xyz|art|club|luxe|kred|test)$/.test(name)
}

/**
 * Base cointype for signature verification
 */
export const BASE_COINTYPE = 60 // ETH cointype, Base uses same as Ethereum 