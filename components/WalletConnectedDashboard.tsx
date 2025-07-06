import { useState, useEffect } from 'react'
import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/router'
import { Address } from 'viem'
import { baseSepolia } from 'wagmi/chains'
import { resolveL2PrimaryName, formatAddress } from '@/lib/ensUtils'
import { 
  useRegisterSubdomain, 
  extractLabelFromPrimaryName, 
  formatSubdomain, 
  getAllTextRecordsWithValues 
} from '@/lib/gitVaultContract'
import SetPrimaryName from '@/components/SetPrimaryName'

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

  // Registration hook
  const { register, isPending: isRegisterPending, isSuccess: isRegisterSuccess, error: registerError } = useRegisterSubdomain()

  // Check if on correct network
  const isOnBaseSepolia = chainId === baseSepolia.id

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
    }

    checkAuthAndName()
  }, [address, isConnected, router])

  // Handle registration success
  useEffect(() => {
    if (isRegisterSuccess && l2PrimaryName) {
      setRegistrationComplete(true)
      loadTextRecords()
    }
  }, [isRegisterSuccess, l2PrimaryName])

  // Manual registration function
  const handleRegisterSubdomain = async () => {
    if (!l2PrimaryName || !address || !isOnBaseSepolia) return
    
    try {
      await register(l2PrimaryName, address as Address)
      console.log('Manual subdomain registration initiated')
    } catch (error) {
      console.error('Manual registration failed:', error)
    }
  }

  // Load text records
  const loadTextRecords = async () => {
    if (!l2PrimaryName) return
    
    setIsLoadingRecords(true)
    try {
      const label = extractLabelFromPrimaryName(l2PrimaryName)
      const records = await getAllTextRecordsWithValues(label)
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
    disconnect()
    router.push('/')
  }

  const handleSetupPrimaryName = () => {
    setShowSetPrimaryName(true)
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

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-lg text-gray-700">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show SetPrimaryName component if user wants to set one
  if (showSetPrimaryName) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <SetPrimaryName
            onSuccess={handlePrimaryNameSet}
            onClose={() => setShowSetPrimaryName(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">GitVault Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Network Indicator */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isOnBaseSepolia 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isSwitchingNetwork ? (
                  <div className="flex items-center space-x-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                    <span>Switching...</span>
                  </div>
                ) : isOnBaseSepolia ? (
                  'Base Sepolia ✓'
                ) : (
                  `Wrong Network (${chainId})`
                )}
              </div>
              
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                {isResolvingName ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-sm">Resolving...</span>
                  </div>
                ) : l2PrimaryName ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-blue-600">{l2PrimaryName}</span>
                    <span className="text-xs text-gray-500">L2</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{address ? formatAddress(address) : 'No Address'}</span>
                    <span className="text-xs text-red-500">No L2 Name</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/')}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Home
              </button>
              <button
                onClick={handleDisconnect}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Network Warning */}
      {!isOnBaseSepolia && !isSwitchingNetwork && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="container mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Please switch to Base Sepolia network to use GitVault features. 
                  <button 
                    onClick={() => switchChain({ chainId: baseSepolia.id })}
                    className="font-medium underline hover:text-yellow-800 ml-1"
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
      <main className="container mx-auto px-4 py-8">
        {l2PrimaryName ? (
          // Show dashboard content when primary name exists
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  Welcome to Dashboard
                </h2>
                <p className="text-lg text-gray-600 mb-2">
                  Hello, <span className="font-medium text-blue-600">{l2PrimaryName}</span>!
                </p>
                <p className="text-gray-500 mb-4">
                  Your L2 primary name is set and verified. You have full access to GitVault.
                </p>
              </div>
            </div>

            {/* Registration Section */}
            {!registrationComplete ? (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    Register Your GitVault Subdomain
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                    Create your GitHub backup subdomain <span className="font-mono text-blue-600">{formatSubdomain(extractLabelFromPrimaryName(l2PrimaryName))}</span> to start managing your repositories and text records.
                  </p>
                  
                  {!isOnBaseSepolia ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <p className="text-yellow-800 text-sm">
                        Switch to Base Sepolia network to register your subdomain
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegisterSubdomain}
                      disabled={isRegisterPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegisterPending ? (
                        <span className="flex items-center justify-center space-x-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Registering Subdomain...</span>
                        </span>
                      ) : (
                        'Register Subdomain'
                      )}
                    </button>
                  )}
                  
                  {registerError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 text-sm">
                        Registration failed: {registerError.message}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Show text records section after successful registration
              <>
                {/* Registration Success */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center space-x-3 text-green-600 mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="text-lg font-semibold">Subdomain Registered Successfully!</h3>
                  </div>
                  <p className="text-gray-600">
                    Your GitHub backup subdomain <span className="font-mono text-blue-600">{formatSubdomain(extractLabelFromPrimaryName(l2PrimaryName))}</span> has been created.
                  </p>
                </div>

                {/* Text Records Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Text Records</h3>
                    <button
                      onClick={handleRefreshRecords}
                      disabled={isLoadingRecords || !isOnBaseSepolia}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoadingRecords ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      <span className="text-sm">Refresh</span>
                    </button>
                  </div>
                  
                  {!isOnBaseSepolia ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <p>Switch to Base Sepolia to view text records</p>
                    </div>
                  ) : isLoadingRecords ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      <span className="ml-2 text-gray-600">Loading text records...</span>
                    </div>
                  ) : Object.keys(textRecords).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(textRecords).map(([key, value]) => (
                        <div key={key} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-medium text-gray-700">Key:</span>
                                <code className="text-sm bg-gray-200 px-2 py-1 rounded">{key}</code>
                              </div>
                              <div className="flex items-start space-x-2">
                                <span className="text-sm font-medium text-gray-700 mt-1">Value:</span>
                                <div className="flex-1">
                                  <code className="text-sm bg-white border px-3 py-2 rounded w-full block break-all">{value}</code>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                      <p>No text records found</p>
                      <p className="text-sm">Records will appear here once your subdomain is configured with data.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Dashboard Features - only show after registration */}
            {registrationComplete && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2M7 21V3a2 2 0 012-2h0a2 2 0 012 2v18M15 21h-2m2 0v-7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Repositories</h3>
                  <p className="text-gray-600 text-sm">Manage your Git repositories</p>
                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                    View Repositories
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">New Repository</h3>
                  <p className="text-gray-600 text-sm">Create a new repository</p>
                  <button className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                    Create Repository
                  </button>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Settings</h3>
                  <p className="text-gray-600 text-sm">Configure your account</p>
                  <button className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors">
                    Open Settings
                  </button>
                </div>
              </div>
            )}

            {/* Stats - only show after registration */}
            {registrationComplete && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{Object.keys(textRecords).length}</div>
                    <div className="text-sm text-gray-500">Text Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-gray-500">Repositories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-gray-500">Commits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">0</div>
                    <div className="text-sm text-gray-500">Storage Used</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Show primary name setup requirement
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.168 14.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Setup Required
              </h2>
              <p className="text-gray-600 mb-6">
                You need to set up an L2 primary name to access the GitVault dashboard. This ensures secure identity verification.
              </p>
              <button
                onClick={handleSetupPrimaryName}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors mb-4"
              >
                Set L2 Primary Name
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default WalletConnectedDashboard 