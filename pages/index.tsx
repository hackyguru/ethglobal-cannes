import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Address } from 'viem'
import { resolveL2PrimaryName, formatAddress } from '@/lib/ensUtils'
import SetPrimaryName from '@/components/SetPrimaryName'

// Dynamically import the wallet-connected component to prevent hydration errors
const WalletConnectedHome = dynamic(() => import('@/components/WalletConnectedHome'), {
  ssr: false,
  loading: () => (
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
              <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-lg"></div>
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
          
          <div className="space-y-4">
            <p className="text-gray-600">Loading wallet connection...</p>
            <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg mx-auto"></div>
          </div>
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

  if (!mounted) {
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
                <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-lg"></div>
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
            
            <div className="space-y-4">
              <p className="text-gray-600">Loading...</p>
              <div className="animate-pulse bg-gray-200 h-12 w-48 rounded-lg mx-auto"></div>
            </div>
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

  return <WalletConnectedHome />
}