import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useRouter } from 'next/router'
import { Address } from 'viem'
import { resolveL2PrimaryName, formatAddress } from '@/lib/ensUtils'
import SetPrimaryName from '@/components/SetPrimaryName'

const WalletConnectedHome = () => {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  
  const [l2PrimaryName, setL2PrimaryName] = useState<string | null>(null)
  const [isResolvingName, setIsResolvingName] = useState(false)
  const [showSetPrimaryName, setShowSetPrimaryName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)

  // Resolve L2 primary name when wallet is connected (but don't redirect)
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

  const handleConnect = async () => {
    // Find MetaMask connector or use the first available one
    const metamaskConnector = connectors.find(connector => 
      connector.name.toLowerCase().includes('metamask') || 
      connector.name.toLowerCase().includes('injected')
    ) || connectors[0]
    
    if (metamaskConnector) {
      try {
        await connect({ connector: metamaskConnector })
        // Redirect to dashboard after successful connection
        router.push('/dashboard')
      } catch (error) {
        console.error('Connection failed:', error)
      }
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
    router.push('/dashboard')
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">GitVault</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {!isConnected ? (
                <div className="flex space-x-2">
                  <button
                    onClick={handleConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Connect MetaMask
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleProceedToDashboard}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Enter Dashboard
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Welcome to <span className="text-blue-600">GitVault</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your secure, decentralized Git repository platform powered by Base Sepolia
          </p>
          <p className="text-lg text-gray-500 mb-12">
            Store, manage, and collaborate on your code with blockchain-backed security and ENS primary names
          </p>
          
          {/* Action based on wallet connection status */}
          {!isConnected && (
            <div className="space-y-4">
              <p className="text-gray-600">Connect your wallet to get started</p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleConnect}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors"
                >
                  Connect MetaMask
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Secure Storage</h3>
            <p className="text-gray-600">Your repositories are secured by blockchain technology and Base Sepolia network</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20a3 3 0 003-3v-2a3 3 0 00-6 0v2a3 3 0 003 3zm8-8a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">ENS Integration</h3>
            <p className="text-gray-600">Use your ENS primary name for seamless identity management across the platform</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Lightning Fast</h3>
            <p className="text-gray-600">Built on Base Sepolia for fast, low-cost transactions and optimal performance</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default WalletConnectedHome 