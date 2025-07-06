import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Address } from 'viem'
import { resolveL2PrimaryName, formatAddress } from '@/lib/ensUtils'
import SetPrimaryName from '@/components/SetPrimaryName'
import Head from 'next/head'

// Dynamically import the wallet-connected component to prevent hydration errors
const WalletConnectedHome = dynamic(() => import('@/components/WalletConnectedHome'), {
  ssr: false,
  loading: () => (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
      </Head>
      <div className="min-h-screen text-[#1b1b1b]" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
        <div className="absolute top-8 right-8">
          <div className="bg-gray-300 h-10 w-32 rounded-xl animate-pulse"></div>
        </div>
        <div className="container mx-auto px-8 py-16 min-h-screen flex items-center">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex justify-center">
              <div className="space-y-8 max-w-2xl">
                <div className="space-y-4 text-center">
                  <h1 className="text-8xl font-black leading-none tracking-tight" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                    n GitVault
                  </h1>
                  <p className="text-xl leading-relaxed" style={{ color: '#1b1b1b' }}>
                    Your secure, decentralized code repository platform with blockchain-backed storage and ENS integration.
                  </p>
                </div>
                <div className="animate-pulse flex justify-center">
                  <div className="bg-gray-300 h-14 w-48 rounded-xl"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  ),
})

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  
  const [l2PrimaryName, setL2PrimaryName] = useState<string | null>(null)
  const [isResolvingName, setIsResolvingName] = useState(false)
  const [showSetPrimaryName, setShowSetPrimaryName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Resolve L2 primary name when wallet connects
  useEffect(() => {
    const checkL2Name = async () => {
      if (!address) {
        setL2PrimaryName(null)
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
      }
    }

    if (isConnected) {
      checkL2Name()
    }
  }, [address, isConnected])

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnect = () => {
    // Find MetaMask connector or use the first available one
    const metamaskConnector = connectors.find(connector => 
      connector.name.toLowerCase().includes('metamask') || 
      connector.name.toLowerCase().includes('injected')
    ) || connectors[0]
    
    if (metamaskConnector) {
      connect({ connector: metamaskConnector })
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setL2PrimaryName(null)
    setShowSetPrimaryName(false)
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
          if (name) {
            // Navigate to dashboard after setting primary name
            router.push('/dashboard')
          }
        })
        .finally(() => setIsResolvingName(false))
    }
  }

  const handleProceedToDashboard = () => {
    if (!l2PrimaryName) {
      setIsCheckingName(true)
      // Double-check if they have a primary name
      if (address) {
        resolveL2PrimaryName(address as Address)
          .then(name => {
            if (name) {
              setL2PrimaryName(name)
              router.push('/dashboard')
            } else {
              setShowSetPrimaryName(true)
            }
          })
          .finally(() => setIsCheckingName(false))
      }
    } else {
      router.push('/dashboard')
    }
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

  if (!mounted) {
    return (
      <>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet" />
        </Head>
        <div className="min-h-screen text-[#1b1b1b]" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
          <div className="absolute top-8 right-8">
            <div className="bg-gray-300 h-10 w-32 rounded-xl animate-pulse"></div>
          </div>
          <div className="container mx-auto px-8 py-16 min-h-screen flex items-center">
            <div className="w-full max-w-7xl mx-auto">
              <div className="flex justify-center">
                <div className="space-y-8 max-w-2xl">
                  <div className="space-y-4 text-center">
                    <h1 className="text-8xl font-black leading-none tracking-tight" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                      GitVault
                    </h1>
                    <p className="text-xl leading-relaxed" style={{ color: '#1b1b1b' }}>
                      Your secure, decentralized code repository platform with blockchain-backed storage and ENS integration.
                    </p>
                  </div>
                  <div className="animate-pulse flex justify-center">
                    <div className="bg-gray-300 h-14 w-48 rounded-xl"></div>
                  </div>
                </div>
              </div>
            </div>
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
      <div className="min-h-screen text-[#1b1b1b]" style={{ background: 'linear-gradient(to bottom right, #ebebeb, #ffffff)' }}>
        {/* Top Right Corner - Connect Wallet */}
        <div className="absolute top-8 right-8 flex items-center space-x-4">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              style={{ 
                backgroundColor: '#9dff00', 
                color: '#1b1b1b' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#8ae600'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#9dff00'
              }}
            >
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#9dff00' }}></div>
                <span className="text-sm font-medium" style={{ color: '#1b1b1b' }}>
                  {formatAddress(address as Address)}
                </span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-sm transition-colors opacity-60 hover:opacity-80"
                style={{ color: '#1b1b1b' }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-8 py-16 min-h-screen flex items-center">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex justify-center">
              <div className="space-y-8 max-w-2xl">
                <div className="space-y-4 text-center">
                  <h1 className="text-8xl font-black leading-none tracking-tight" style={{ color: '#1b1b1b', fontFamily: 'VT323, monospace' }}>
                    GitVault
                  </h1>
                  <p className="text-xl leading-relaxed" style={{ color: '#1b1b1b' }}>
                    Secure your code repositories with decentralized storage powered by blockchain technology and ENS integration.
                  </p>
                </div>
                
                {/* Status Display */}
                <div className="space-y-4 flex flex-col items-center">
                  {!isConnected ? (
                    <div className="text-center">
                      <p className="text-sm opacity-60" style={{ color: '#1b1b1b' }}>
                        Connect your wallet to start securing your repositories
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center">
                      {isResolvingName ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div 
                            className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent"
                            style={{ borderColor: '#9dff00' }}
                          ></div>
                          <span className="opacity-60" style={{ color: '#1b1b1b' }}>Resolving ENS name...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {l2PrimaryName ? (
                            <div className="space-y-2">
                              <p className="font-medium" style={{ color: '#9dff00' }}>
                                Welcome back, {l2PrimaryName}
                              </p>
                              <button
                                onClick={handleProceedToDashboard}
                                className="px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                style={{ 
                                  backgroundColor: '#9dff00', 
                                  color: '#1b1b1b' 
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#8ae600'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#9dff00'
                                }}
                              >
                                Enter Dashboard
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="opacity-60" style={{ color: '#1b1b1b' }}>
                                Set up your ENS primary name for the full experience
                              </p>
                              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 justify-center">
                                <button
                                  onClick={handleSetupPrimaryName}
                                  className="px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg"
                                  style={{ 
                                    backgroundColor: '#9dff00', 
                                    color: '#1b1b1b' 
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#8ae600'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#9dff00'
                                  }}
                                >
                                  Setup ENS Name
                                </button>
                                <button
                                  onClick={() => router.push('/dashboard')}
                                  className="px-6 py-3 rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg bg-gray-300 hover:bg-gray-400"
                                  style={{ color: '#1b1b1b' }}
                                >
                                  Skip for Now
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}