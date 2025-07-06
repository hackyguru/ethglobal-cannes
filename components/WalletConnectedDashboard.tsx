import { useState, useEffect } from 'react'
import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/router'
import { Address } from 'viem'
import { baseSepolia } from 'wagmi/chains'
import { resolveL2PrimaryName, resolveEnsName, formatAddress, baseSepoliaClient } from '@/lib/ensUtils'
import { 
  useRegisterSubdomain, 
  formatSubdomain, 
  getAllTextRecordsWithValues,
  GITVAULT_REGISTRY_CONTRACT,
  GITVAULT_REGISTRY_ABI
} from '@/lib/gitVaultContract'
import SetPrimaryName from '@/components/SetPrimaryName'
import Head from 'next/head'

const WalletConnectedDashboard = () => {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const router = useRouter()
  
  const [l2PrimaryName, setL2PrimaryName] = useState<string | null>(null)
  const [isResolvingName, setIsResolvingName] = useState(false)
  const [showSetPrimaryName, setShowSetPrimaryName] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [textRecords, setTextRecords] = useState<Record<string, string>>({})
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [isValidLabel, setIsValidLabel] = useState(false)
  const [registeredLabel, setRegisteredLabel] = useState('')
  const [hasSkippedL2Setup, setHasSkippedL2Setup] = useState(false)
  const [isCheckingExistingSubdomain, setIsCheckingExistingSubdomain] = useState(false)
  const [existingSubdomain, setExistingSubdomain] = useState<string | null>(null)
  const [subdomainLoadedFromStorage, setSubdomainLoadedFromStorage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ subdomain: string; repository: string; blobId: string } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)


  // Registration hook
  const { register, isPending: isRegisterPending, isSuccess: isRegisterSuccess, error: registerError } = useRegisterSubdomain()

  // LocalStorage keys
  const SUBDOMAIN_STORAGE_KEY = 'gitvault_registered_subdomain'
  const WALLET_SUBDOMAIN_KEY = (walletAddress: string) => `gitvault_subdomain_${walletAddress.toLowerCase()}`

  // LocalStorage helpers
  const saveSubdomainToStorage = (walletAddress: string, subdomain: string) => {
    try {
      localStorage.setItem(WALLET_SUBDOMAIN_KEY(walletAddress), subdomain)
      localStorage.setItem(SUBDOMAIN_STORAGE_KEY, subdomain) // For backward compatibility
      console.log(`💾 Saved subdomain '${subdomain}' to localStorage for wallet ${walletAddress}`)
    } catch (error) {
      console.error('Error saving subdomain to localStorage:', error)
    }
  }

  const loadSubdomainFromStorage = (walletAddress: string): string | null => {
    try {
      // Try wallet-specific key first
      const walletSpecificSubdomain = localStorage.getItem(WALLET_SUBDOMAIN_KEY(walletAddress))
      if (walletSpecificSubdomain) {
        return walletSpecificSubdomain
      }

      // Fall back to general key for backward compatibility
      const generalSubdomain = localStorage.getItem(SUBDOMAIN_STORAGE_KEY)
      if (generalSubdomain) {
        // Migrate to wallet-specific storage
        saveSubdomainToStorage(walletAddress, generalSubdomain)
        localStorage.removeItem(SUBDOMAIN_STORAGE_KEY)
        return generalSubdomain
      }

      return null
    } catch (error) {
      console.error('Error loading subdomain from localStorage:', error)
      return null
    }
  }

  const clearSubdomainFromStorage = (walletAddress: string) => {
    try {
      localStorage.removeItem(WALLET_SUBDOMAIN_KEY(walletAddress))
      localStorage.removeItem(SUBDOMAIN_STORAGE_KEY)
      console.log(`🗑️ Cleared subdomain from localStorage for wallet ${walletAddress}`)
    } catch (error) {
      console.error('Error clearing subdomain from localStorage:', error)
    }
  }

  // Check if on correct network
  const isOnBaseSepolia = chainId === baseSepolia.id

  // Validate label input
  const validateLabel = (label: string) => {
    // Basic validation: alphanumeric, 3-20 characters, no spaces
    const isValid = /^[a-zA-Z0-9]{3,20}$/.test(label)
    setIsValidLabel(isValid)
    return isValid
  }

  // Handle label input change
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase()
    setCustomLabel(value)
    validateLabel(value)
  }

  // Generate default label from wallet address
  const generateDefaultLabel = (address: string): string => {
    // Remove '0x' prefix and take first 8 characters
    return address.slice(2, 10).toLowerCase()
  }

  // Helper function to detect if a value is likely a Walrus blob ID
  const isWalrusBlobId = (value: string): boolean => {
    // Walrus blob IDs are typically base64-like strings with specific patterns
    // They contain letters, numbers, hyphens, and underscores
    // Usually around 40-50 characters long
    const blobIdPattern = /^[A-Za-z0-9_-]{30,60}$/
    return blobIdPattern.test(value)
  }

  // Check if user already has a subdomain
  const checkExistingSubdomain = async (address: string) => {
    setIsCheckingExistingSubdomain(true)
    console.log(`🔍 Checking subdomain for wallet: ${address}`)
    
    try {
      // First check localStorage for previously registered subdomain
      const storedSubdomain = loadSubdomainFromStorage(address)
      if (storedSubdomain) {
        console.log(`📱 Found stored subdomain: ${storedSubdomain} for wallet: ${address}`)
        
        // Verify the stored subdomain still exists on the blockchain
        const isAvailable = await baseSepoliaClient.readContract({
          address: GITVAULT_REGISTRY_CONTRACT,
          abi: GITVAULT_REGISTRY_ABI,
          functionName: 'available',
          args: [storedSubdomain],
        }) as boolean

        if (!isAvailable) {
          // Subdomain still exists, use it
          setExistingSubdomain(storedSubdomain)
          setRegisteredLabel(storedSubdomain)
          setSubdomainLoadedFromStorage(true)
          console.log(`✅ Verified stored subdomain: ${storedSubdomain}.gitvault.eth for wallet: ${address}`)
          return
        } else {
          // Subdomain no longer exists, clear from storage
          clearSubdomainFromStorage(address)
          setSubdomainLoadedFromStorage(false)
          console.log(`❌ Stored subdomain ${storedSubdomain} no longer exists, cleared from storage for wallet: ${address}`)
        }
      } else {
        console.log(`📭 No stored subdomain found for wallet: ${address}`)
      }

      let labelToCheck: string
      
      // Try to resolve ENS name from mainnet
      console.log(`🔍 Resolving ENS name for address: ${address}`)
      const ensName = await resolveEnsName(address as Address)
      
      if (ensName) {
        // Use ENS name without .eth suffix as label
        labelToCheck = ensName.replace(/\.eth$/, '')
        console.log(`🏷️ Found ENS name: ${ensName}, using label: ${labelToCheck} for wallet: ${address}`)
      } else {
        // Fall back to generated label from wallet address
        labelToCheck = generateDefaultLabel(address)
        console.log(`🏷️ No ENS name found, using generated label: ${labelToCheck} for wallet: ${address}`)
      }
      
      // Check if this label is available on GitVault (if not available, it means it's registered)
      const isAvailable = await baseSepoliaClient.readContract({
        address: GITVAULT_REGISTRY_CONTRACT,
        abi: GITVAULT_REGISTRY_ABI,
        functionName: 'available',
        args: [labelToCheck],
      }) as boolean

      if (!isAvailable) {
        // Subdomain exists, set it as existing and save to storage
        setExistingSubdomain(labelToCheck)
        setRegisteredLabel(labelToCheck)
        setSubdomainLoadedFromStorage(false) // This was found via blockchain, not storage
        saveSubdomainToStorage(address, labelToCheck)
        console.log(`Found existing GitVault subdomain: ${labelToCheck}.gitvault.eth`)
      } else {
        // No existing subdomain, user needs to register
        setExistingSubdomain(null)
        setSubdomainLoadedFromStorage(false)
        console.log(`No existing GitVault subdomain for address ${address}`)
      }
    } catch (error) {
      console.error('Error checking existing subdomain:', error)
      setExistingSubdomain(null)
    } finally {
      setIsCheckingExistingSubdomain(false)
    }
  }

  // Auto-switch to Base Sepolia if not already on it
  useEffect(() => {
    const switchToBaseSepolia = async () => {
      if (isConnected && !isOnBaseSepolia && !isSwitchingNetwork) {
        setIsSwitchingNetwork(true)
        try {
          await switchChain({ chainId: baseSepolia.id })
        } catch (error) {
          console.error('Failed to switch to Base Sepolia:', error)
        } finally {
          setIsSwitchingNetwork(false)
        }
      }
    }

    switchToBaseSepolia()
  }, [isConnected, isOnBaseSepolia, switchChain, isSwitchingNetwork])

  // Reset subdomain state when wallet changes
  useEffect(() => {
    if (address) {
      // Clear previous wallet's subdomain state
      setExistingSubdomain(null)
      setRegisteredLabel('')
      setRegistrationComplete(false)
      setSubdomainLoadedFromStorage(false)
      setTextRecords({})
      setCustomLabel('')
      setIsValidLabel(false)
      
      // Clear search state
      setSearchQuery('')
      setSearchResults(null)
      setSearchError(null)
      
      console.log(`🔄 Wallet changed to: ${address}`)
    }
  }, [address])

  // Check authentication and resolve primary name
  useEffect(() => {
    const checkAuthAndName = async () => {
      // Redirect to home if not connected
      if (!isConnected || !address) {
        router.push('/')
        return
      }

      setIsResolvingName(true)
      try {
        const name = await resolveL2PrimaryName(address as Address)
        setL2PrimaryName(name)
      } catch (error) {
        console.error('Error resolving L2 name:', error)
        setL2PrimaryName(null)
      } finally {
        setIsResolvingName(false)
        setIsLoading(false)
      }

      // Check for existing subdomain
      if (isOnBaseSepolia) {
        await checkExistingSubdomain(address)
      }
    }

    checkAuthAndName()
  }, [address, isConnected, router, isOnBaseSepolia])

  // Handle registration success
  useEffect(() => {
    if (isRegisterSuccess && customLabel && address) {
      setRegistrationComplete(true)
      setRegisteredLabel(customLabel)
      // Save the registered subdomain to localStorage
      saveSubdomainToStorage(address, customLabel)
      loadTextRecords(customLabel)
    }
  }, [isRegisterSuccess, customLabel, address])

  // Load text records when existing subdomain is found
  useEffect(() => {
    if (existingSubdomain) {
      setRegistrationComplete(true)
      loadTextRecords(existingSubdomain)
    }
  }, [existingSubdomain])

  // Manual registration function
  const handleRegisterSubdomain = async () => {
    if (!customLabel || !address || !isOnBaseSepolia || !isValidLabel) return
    
    try {
      // Use just the custom label without any suffix
      await register(customLabel, address as Address)
      console.log('Manual subdomain registration initiated with label:', customLabel)
    } catch (error) {
      console.error('Manual registration failed:', error)
    }
  }

  // Load text records
  const loadTextRecords = async (label?: string) => {
    const labelToUse = label || registeredLabel
    if (!labelToUse) return
    
    setIsLoadingRecords(true)
    try {
      const records = await getAllTextRecordsWithValues(labelToUse)
      setTextRecords(records)
    } catch (error) {
      console.error('Error loading text records:', error)
    } finally {
      setIsLoadingRecords(false)
    }
  }

  // Refresh records manually
  const handleRefreshRecords = () => {
    loadTextRecords()
  }

  const handleDisconnect = () => {
    // Clear all subdomain state when disconnecting
    setExistingSubdomain(null)
    setRegisteredLabel('')
    setRegistrationComplete(false)
    setSubdomainLoadedFromStorage(false)
    setTextRecords({})
    setCustomLabel('')
    setIsValidLabel(false)
    setL2PrimaryName(null)
    
    // Clear search state
    setSearchQuery('')
    setSearchResults(null)
    setSearchError(null)
    
    console.log('🔌 Wallet disconnected, cleared all state')
    disconnect()
    router.push('/')
  }

  const handleSetupPrimaryName = () => {
    setShowSetPrimaryName(true)
  }

  const handleSkipL2Setup = () => {
    setHasSkippedL2Setup(true)
  }

  const handlePrimaryNameSet = () => {
    setShowSetPrimaryName(false)
    // Refresh the name
    if (address) {
      setIsResolvingName(true)
      resolveL2PrimaryName(address as Address)
        .then(name => {
          setL2PrimaryName(name)
        })
        .finally(() => setIsResolvingName(false))
    }
  }

  // Clear stored subdomain and force re-registration
  const handleClearStoredSubdomain = () => {
    if (address) {
      clearSubdomainFromStorage(address)
      setExistingSubdomain(null)
      setRegisteredLabel('')
      setRegistrationComplete(false)
      setSubdomainLoadedFromStorage(false)
      setTextRecords({})
    }
  }

  // Search for repository across subdomains
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a search query')
      return
    }

    // Parse query in format "subdomain/repository"
    const parts = searchQuery.trim().split('/')
    if (parts.length !== 2) {
      setSearchError('Please use format: subdomain/repository (e.g., hackyguru/walrus-action-test)')
      return
    }

    const [subdomain, repository] = parts
    if (!subdomain || !repository) {
      setSearchError('Both subdomain and repository name are required')
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setSearchResults(null)

    try {
      console.log(`🔍 Searching for repository: ${repository} in subdomain: ${subdomain}`)
      
      // Get text records for the target subdomain
      const records = await getAllTextRecordsWithValues(subdomain)
      console.log(`📋 Found ${Object.keys(records).length} records in ${subdomain}.gitvault.eth`)

      // Look for the specific repository
      const blobId = records[repository]
      if (blobId && isWalrusBlobId(blobId)) {
        setSearchResults({ subdomain, repository, blobId })
        console.log(`✅ Found repository ${repository} with blob ID: ${blobId}`)
      } else if (blobId) {
        setSearchError(`Found record for "${repository}" but it doesn't appear to be a valid Walrus blob ID`)
      } else {
        setSearchError(`Repository "${repository}" not found in ${subdomain}.gitvault.eth`)
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchError(`Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSearching(false)
    }
  }

  // Clear search results
  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
    setSearchError(null)
  }

  const handleRepositoryClick = (name: string, blobId: string) => {
    router.push(`/repository/${encodeURIComponent(name)}?blobId=${encodeURIComponent(blobId)}`)
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
        </Head>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
          <div className="bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-8 max-w-md mx-auto border border-gray-300/50">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#9dff00' }}></div>
              <span className="text-lg" style={{ color: '#1b1b1b' }}>Loading...</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Show SetPrimaryName component if user wants to set one
  if (showSetPrimaryName) {
    return (
      <>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
        </Head>
        <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
          <div className="container mx-auto px-4 py-8">
            <SetPrimaryName
              onSuccess={handlePrimaryNameSet}
              onClose={() => setShowSetPrimaryName(false)}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </Head>
      <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-300/50">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#9dff00' }}>
                  <span className="font-bold text-xl" style={{ color: '#1b1b1b' }}>G</span>
                </div>
                <div></div>
              </div>
            
              <div className="flex items-center space-x-4">
                {/* Network Indicator */}
                <div className={`px-4 py-2 rounded-full text-xs font-semibold shadow-md ${
                  isOnBaseSepolia 
                    ? 'text-white' 
                    : 'text-white'
                }`} style={{ backgroundColor: isOnBaseSepolia ? '#9dff00' : '#ff6b6b' }}>
                  {isSwitchingNetwork ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                      <span>Switching...</span>
                    </div>
                  ) : isOnBaseSepolia ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      <span>Base Sepolia</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span>Wrong Network</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-300/40 shadow-sm">
                  {isResolvingName ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: '#9dff00' }}></div>
                      <span className="text-sm" style={{ color: '#1b1b1b' }}>Resolving...</span>
                    </div>
                  ) : l2PrimaryName ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9dff00' }}></div>
                      <span className="text-sm font-semibold" style={{ color: '#9dff00' }}>{l2PrimaryName}</span>
                      <span className="text-xs px-2 py-1 rounded-full" style={{ color: '#1b1b1b', backgroundColor: '#9dff00', opacity: 0.8 }}>L2</span>
                    </div>
                  ) : hasSkippedL2Setup ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-sm font-mono" style={{ color: '#1b1b1b' }}>{address ? formatAddress(address) : 'No Address'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-mono" style={{ color: '#1b1b1b' }}>{address ? formatAddress(address) : 'No Address'}</span>
                      <span className="text-xs bg-red-100 px-2 py-1 rounded-full" style={{ color: '#dc2626' }}>Setup Required</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => router.push('/')}
                    className="px-4 py-2 hover:bg-gray-300/60 rounded-lg transition-all duration-200 text-sm font-medium"
                    style={{ color: '#1b1b1b' }}
                  >
                    Home
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#dc2626' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#b91c1c'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626'
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
          </div>
        </div>
      </header>

        {/* Network Warning */}
        {!isOnBaseSepolia && !isSwitchingNetwork && (
          <div className="shadow-lg" style={{ backgroundColor: '#fcd34d' }}>
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#1b1b1b' }}>
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium" style={{ color: '#1b1b1b' }}>
                    Please switch to Base Sepolia network to use GitVault features. 
                    <button 
                      onClick={() => switchChain({ chainId: baseSepolia.id })}
                      className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 font-semibold"
                      style={{ color: '#1b1b1b' }}
                    >
                      Switch Network
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-6 py-10">
          {l2PrimaryName || hasSkippedL2Setup ? (
            // Show dashboard content when primary name exists or user has skipped setup
            <div className="space-y-10">

              {/* Global Repository Search */}
              <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-gray-300/30 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>Search Repositories</h3>
                  </div>
                </div>
              
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="e.g., hackyguru/walrus-action-test"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full px-6 py-4 border-2 border-gray-300 rounded-2xl focus:ring-4 focus:border-green-500 transition-all duration-200 text-lg bg-white/80 backdrop-blur-sm disabled:opacity-50"
                      style={{ 
                        color: '#1b1b1b',
                        '--tw-ring-color': '#9dff00',
                        '--tw-ring-opacity': '0.2'
                      } as React.CSSProperties}
                      disabled={isSearching}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-8 py-4 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    style={{ backgroundColor: '#9dff00' }}
                    onMouseEnter={(e) => {
                      if (!isSearching && searchQuery.trim()) {
                        e.currentTarget.style.backgroundColor = '#8ae600'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#9dff00'
                    }}
                  >
                    {isSearching ? (
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: '#1b1b1b' }}></div>
                        <span style={{ color: '#1b1b1b' }}>Searching...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span style={{ color: '#1b1b1b' }}>Search</span>
                      </div>
                    )}
                  </button>
                  {(searchResults || searchError) && (
                    <button
                      onClick={handleClearSearch}
                      className="px-6 py-4 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                      style={{ backgroundColor: '#6b7280' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#4b5563'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#6b7280'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Search Error */}
                {searchError && (
                  <div className="mt-6 p-6 bg-red-100 border-2 border-red-300 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#dc2626' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg" style={{ color: '#dc2626' }}>Search Error</h4>
                        <p style={{ color: '#dc2626', opacity: 0.8 }}>{searchError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {searchResults && (
                  <div className="mt-8 border-2 border-green-300 rounded-3xl bg-green-100 backdrop-blur-sm overflow-hidden shadow-xl">
                    {/* Header */}
                    <div className="px-8 py-6 bg-green-200/50 border-b border-green-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#16a34a' }}>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="text-xl font-bold" style={{ color: '#16a34a', fontFamily: 'VT323, monospace' }}>Repository Found!</h4>
                            <div className="flex items-center space-x-3 mt-1">
                              <span className="text-sm font-medium" style={{ color: '#1b1b1b', opacity: 0.7 }}>Repository:</span>
                              <code className="text-lg bg-white px-4 py-2 rounded-xl font-mono border border-green-400 font-semibold" style={{ color: '#16a34a' }}>
                                {searchResults.subdomain}/{searchResults.repository}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center space-x-6 text-sm" style={{ color: '#1b1b1b', opacity: 0.7 }}>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#9dff00' }}></div>
                          <span><span className="font-semibold">Subdomain:</span> {searchResults.subdomain}.gitvault.eth</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span><span className="font-semibold">Blob ID:</span> <code className="font-mono">{searchResults.blobId}</code></span>
                        </div>
                      </div>
                    </div>

                    {/* Repository Content */}
                    <div className="p-8">
                      <div className="text-center">
                        <button
                          onClick={() => handleRepositoryClick(searchResults.repository, searchResults.blobId)}
                          className="text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
                          style={{ backgroundColor: '#9dff00' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#8ae600'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#9dff00'
                          }}
                        >
                          <span style={{ color: '#1b1b1b' }}>View Repository Files</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Registration Section */}
            {!registrationComplete ? (
              // Show loading while checking for existing subdomain
              isCheckingExistingSubdomain ? (
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-gray-300/30 p-10">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ backgroundColor: '#9dff00' }}>
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1b1b1b' }}></div>
                    </div>
                    <h3 className="text-3xl font-bold mb-4" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                      Checking Your Subdomain
                    </h3>
                    <p className="text-lg leading-relaxed" style={{ color: '#1b1b1b', opacity: 0.7 }}>
                      We're checking if you already have a GitVault subdomain...
                    </p>
                  </div>
                </div>
              ) : existingSubdomain ? (
                // Show existing subdomain found message - skip this display
                <div></div>
              ) : (
                // Show registration form for new users
                <div className="bg-white/70 backdrop-blur-md rounded-lg shadow-lg p-8 border border-gray-300/30">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#9dff00' }}>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-4" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                      Register Your GitVault Subdomain
                    </h3>
                    <p className="mb-6 max-w-2xl mx-auto" style={{ color: '#1b1b1b', opacity: 0.7 }}>
                      Choose a custom label for your GitHub backup subdomain. It will be created as <span className="font-mono" style={{ color: '#9dff00' }}>{customLabel || '[your-label]'}.gitvault.eth</span>
                    </p>
                    
                    {!isOnBaseSepolia ? (
                      <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 mb-6">
                        <p className="text-sm" style={{ color: '#1b1b1b' }}>
                          Switch to Base Sepolia network to register your subdomain
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="max-w-md mx-auto">
                          <label htmlFor="label-input" className="block text-sm font-medium mb-2" style={{ color: '#1b1b1b' }}>
                            Subdomain Label
                          </label>
                          <input
                            id="label-input"
                            type="text"
                            value={customLabel}
                            onChange={handleLabelChange}
                            placeholder="Enter your label (e.g., myproject)"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-green-500 outline-none"
                            style={{ 
                              color: '#1b1b1b',
                              '--tw-ring-color': '#9dff00',
                              '--tw-ring-opacity': '0.2'
                            } as React.CSSProperties}
                          />
                          {customLabel && (
                            <div className="mt-2 text-sm">
                              {isValidLabel ? (
                                <p style={{ color: '#16a34a' }}>✓ Valid label: {customLabel}.gitvault.eth</p>
                              ) : (
                                <p style={{ color: '#dc2626' }}>✗ Label must be 3-20 alphanumeric characters</p>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleRegisterSubdomain}
                          disabled={isRegisterPending || !isValidLabel || !customLabel}
                          className="text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#9dff00' }}
                          onMouseEnter={(e) => {
                            if (!isRegisterPending && isValidLabel && customLabel) {
                              e.currentTarget.style.backgroundColor = '#8ae600'
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#9dff00'
                          }}
                        >
                          {isRegisterPending ? (
                            <span className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: '#1b1b1b' }}></div>
                              <span style={{ color: '#1b1b1b' }}>Registering Subdomain...</span>
                            </span>
                          ) : (
                            <span style={{ color: '#1b1b1b' }}>Register Subdomain</span>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {registerError && (
                      <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-4">
                        <p className="text-sm" style={{ color: '#dc2626' }}>
                          Registration failed: {registerError.message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            ) : (
              // Show text records section after successful registration
              <>

                  {/* Text Records Section */}
                  <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-gray-300/30 p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>Your Repositories</h3>
                        </div>
                      </div>
                      <button
                        onClick={handleRefreshRecords}
                        disabled={isLoadingRecords || !isOnBaseSepolia}
                        className="flex items-center space-x-3 px-6 py-3 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#9dff00' }}
                        onMouseEnter={(e) => {
                          if (!isLoadingRecords && isOnBaseSepolia) {
                            e.currentTarget.style.backgroundColor = '#8ae600'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#9dff00'
                        }}
                      >
                        {isLoadingRecords ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: '#1b1b1b' }}></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        <span style={{ color: '#1b1b1b' }}>Refresh</span>
                      </button>
                    </div>
                  
                    {!isOnBaseSepolia ? (
                      <div className="text-center py-8" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b', opacity: 0.5 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p>Switch to Base Sepolia to view text records</p>
                      </div>
                    ) : isLoadingRecords ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#9dff00' }}></div>
                        <span className="ml-2" style={{ color: '#1b1b1b', opacity: 0.7 }}>Loading text records...</span>
                      </div>
                    ) : Object.keys(textRecords).length > 0 ? (
                    // Show repository cards
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {Object.entries(textRecords).map(([key, value]) => (
                        <div key={key} className="group">
                          {isWalrusBlobId(value) ? (
                            <div
                              onClick={() => handleRepositoryClick(key, value)}
                              className="border-2 border-gray-300/50 rounded-3xl bg-white/70 backdrop-blur-sm overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:bg-white/90"
                              style={{ '--hover-border': '#9dff00' } as React.CSSProperties}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#9dff00'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(209, 213, 219, 0.5)'
                              }}
                            >
                              {/* Header */}
                              <div className="px-6 py-4 bg-gray-100/80 border-b border-gray-300/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-lg font-bold" style={{ color: '#1b1b1b' }}>{key}</p>
                                      <p className="text-sm" style={{ color: '#1b1b1b', opacity: 0.6 }}>Repository backup</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl shadow-md" style={{ backgroundColor: '#9dff00', color: '#1b1b1b' }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-semibold">Backed up</span>
                                  </div>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="p-6">
                                <div className="flex items-center space-x-3 p-3 rounded-2xl border border-gray-300/50" style={{ backgroundColor: 'rgba(157, 255, 0, 0.1)' }}>
                                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#9dff00' }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold" style={{ color: '#1b1b1b' }}>Walrus Blob ID</p>
                                    <code className="text-xs bg-gray-200 px-2 py-1 rounded-lg font-mono truncate max-w-[200px] block" style={{ color: '#1b1b1b' }}>{value}</code>
                                  </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                  <div className="flex items-center space-x-2" style={{ color: '#1b1b1b', opacity: 0.6 }}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    <span className="text-sm">Click to view files</span>
                                  </div>
                                  <div className="flex items-center space-x-2 transition-colors" style={{ color: '#9dff00' }}>
                                    <span className="text-sm font-medium">Explore</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="border-2 border-gray-300/50 rounded-3xl bg-white/70 backdrop-blur-sm overflow-hidden shadow-lg">
                              <div className="px-6 py-4 bg-gray-100/80 border-b border-gray-300/50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-gray-400 rounded-2xl flex items-center justify-center">
                                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-lg font-bold" style={{ color: '#1b1b1b' }}>{key}</p>
                                      <p className="text-sm" style={{ color: '#1b1b1b', opacity: 0.6 }}>Raw data</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 px-3 py-2 bg-gray-500 rounded-xl text-white shadow-md">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <span className="text-sm font-semibold">Raw</span>
                                  </div>
                                </div>
                              </div>
                              <div className="p-6">
                                <div className="flex items-start space-x-3">
                                  <div className="w-8 h-8 bg-gray-400 rounded-xl flex items-center justify-center mt-1">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold mb-2" style={{ color: '#1b1b1b' }}>Raw Value</p>
                                    <code className="text-sm bg-gray-200 border border-gray-300 px-4 py-3 rounded-2xl w-full block break-all" style={{ color: '#1b1b1b' }}>{value}</code>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b', opacity: 0.5 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold mb-4" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>No repositories found</h3>
                        <p className="text-lg leading-relaxed max-w-md mx-auto mb-2" style={{ color: '#1b1b1b', opacity: 0.7 }}>
                          Records will appear here once your subdomain is configured with data.
                        </p>
                        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#9dff00', opacity: 0.2, color: '#1b1b1b' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>💡 Tip: Each wallet has its own subdomain and repositories</span>
                        </div>
                      </div>
                    )}
                </div>
              </>
            )}


          </div>
          ) : (
            // Show primary name setup option (optional)
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-300/30 p-12 max-w-lg mx-auto text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg" style={{ backgroundColor: '#9dff00' }}>
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#1b1b1b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold mb-6" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                  L2 Primary Name Setup
                </h2>
                <p className="text-lg leading-relaxed mb-8" style={{ color: '#1b1b1b', opacity: 0.7 }}>
                  You can set up an L2 primary name for enhanced identity verification, or skip this step and use GitVault with your wallet address.
                </p>
                <div className="space-y-4">
                  <button
                    onClick={handleSetupPrimaryName}
                    className="w-full text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
                    style={{ backgroundColor: '#9dff00' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#8ae600'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#9dff00'
                    }}
                  >
                    <span style={{ color: '#1b1b1b' }}>Set L2 Primary Name</span>
                  </button>
                  <button
                    onClick={handleSkipL2Setup}
                    className="w-full text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
                    style={{ backgroundColor: '#16a34a' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#15803d'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#16a34a'
                    }}
                  >
                    Skip L2 Setup
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="w-full px-8 py-3 rounded-2xl font-medium transition-all duration-200 border border-gray-400 hover:border-gray-500"
                    style={{ color: '#1b1b1b', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  </>
  )
}

export default WalletConnectedDashboard 