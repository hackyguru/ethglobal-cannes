import { Address } from 'viem'
import { useWriteContract, useReadContract, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { baseSepoliaClient } from './ensUtils'

// GitVault Registry contract address on Base Sepolia
export const GITVAULT_REGISTRY_CONTRACT = '0x1c10424bF8149F7cB10d1989679bfA6933799e4d' as Address

// Fixed owner address as specified
export const GITVAULT_OWNER = '0x18331B7b011d822F963236d0b6b8775Fb86fc1AF' as Address

// Contract ABI - using the correct ABI provided by the user
export const GITVAULT_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_registry', type: 'address' }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'label', type: 'string' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' }
    ],
    name: 'NameRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'label', type: 'string' },
      { indexed: true, internalType: 'string', name: 'repository', type: 'string' },
      { indexed: false, internalType: 'string', name: 'cid', type: 'string' }
    ],
    name: 'TextRecordUpdated',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' }
    ],
    name: 'available',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'chainId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'coinType',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' }
    ],
    name: 'getAllTextRecords',
    outputs: [
      { internalType: 'string[]', name: 'keys', type: 'string[]' },
      { internalType: 'string[]', name: 'values', type: 'string[]' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' },
      { internalType: 'string', name: 'key', type: 'string' }
    ],
    name: 'getTextRecord',
    outputs: [{ internalType: 'string', name: 'value', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' }
    ],
    name: 'getTextRecordKeys',
    outputs: [{ internalType: 'string[]', name: 'keys', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' },
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'addr', type: 'address' }
    ],
    name: 'register',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'registry',
    outputs: [{ internalType: 'contract IL2Registry', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'label', type: 'string' },
      { internalType: 'string', name: 'repository', type: 'string' },
      { internalType: 'string', name: 'cid', type: 'string' }
    ],
    name: 'updateTextRecord',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * Extract label from primary name by removing .eth suffix
 */
export const extractLabelFromPrimaryName = (primaryName: string): string => {
  return primaryName.replace(/\.eth$/, '')
}

/**
 * Hook to register a subdomain
 */
export const useRegisterSubdomain = () => {
  const { writeContract, isPending, isSuccess, error } = useWriteContract()
  const { switchChain } = useSwitchChain()

  const register = async (primaryName: string, userAddress: Address) => {
    const label = extractLabelFromPrimaryName(primaryName)
    
    try {
      // First, ensure we're on Base Sepolia
      await switchChain({ chainId: baseSepolia.id })
      
      await writeContract({
        address: GITVAULT_REGISTRY_CONTRACT,
        abi: GITVAULT_REGISTRY_ABI,
        functionName: 'register',
        args: [label, GITVAULT_OWNER, userAddress],
        chainId: baseSepolia.id,
      })
      
      console.log(`Registering subdomain: ${label}.gitvault.xyz for user ${userAddress} on Base Sepolia`)
    } catch (error) {
      console.error('Error registering subdomain:', error)
      throw error
    }
  }

  return { register, isPending, isSuccess, error }
}

/**
 * Hook to check if a label is available
 */
export const useCheckAvailable = (label: string) => {
  return useReadContract({
    address: GITVAULT_REGISTRY_CONTRACT,
    abi: GITVAULT_REGISTRY_ABI,
    functionName: 'available',
    args: [label],
    chainId: baseSepolia.id,
    query: {
      enabled: !!label,
    },
  })
}

/**
 * Hook to get all text record keys for a label
 */
export const useGetAllTextRecords = (label: string) => {
  return useReadContract({
    address: GITVAULT_REGISTRY_CONTRACT,
    abi: GITVAULT_REGISTRY_ABI,
    functionName: 'getAllTextRecords',
    args: [label],
    chainId: baseSepolia.id,
    query: {
      enabled: !!label,
    },
  })
}

/**
 * Hook to get just the text record keys
 */
export const useGetTextRecordKeys = (label: string) => {
  return useReadContract({
    address: GITVAULT_REGISTRY_CONTRACT,
    abi: GITVAULT_REGISTRY_ABI,
    functionName: 'getTextRecordKeys',
    args: [label],
    chainId: baseSepolia.id,
    query: {
      enabled: !!label,
    },
  })
}

/**
 * Hook to get a specific text record
 */
export const useGetTextRecord = (label: string, key: string) => {
  return useReadContract({
    address: GITVAULT_REGISTRY_CONTRACT,
    abi: GITVAULT_REGISTRY_ABI,
    functionName: 'getTextRecord',
    args: [label, key],
    chainId: baseSepolia.id,
    query: {
      enabled: !!label && !!key,
    },
  })
}

/**
 * Get all text records with their values
 */
export const getAllTextRecordsWithValues = async (label: string): Promise<Record<string, string>> => {
  try {
    // First check if the label is available (not registered)
    const available = await baseSepoliaClient.readContract({
      address: GITVAULT_REGISTRY_CONTRACT,
      abi: GITVAULT_REGISTRY_ABI,
      functionName: 'available',
      args: [label],
    }) as boolean

    if (available) {
      console.log(`Label "${label}" is available (not registered yet)`)
      return {}
    }

    // Label is registered, get both keys and values in one call
    const result = await baseSepoliaClient.readContract({
      address: GITVAULT_REGISTRY_CONTRACT,
      abi: GITVAULT_REGISTRY_ABI,
      functionName: 'getAllTextRecords',
      args: [label],
    }) as [string[], string[]]

    const [keys, values] = result
    const records: Record<string, string> = {}
    
    // Combine keys and values into a record
    for (let i = 0; i < keys.length; i++) {
      records[keys[i]] = values[i] || ''
    }

    console.log(`Found ${keys.length} text records for label "${label}"`)
    return records
  } catch (error) {
    console.error('Error getting text records:', error)
    return {}
  }
}

/**
 * Format subdomain name for display
 */
export const formatSubdomain = (label: string): string => {
  return `${label}.gitvault.eth`
} 