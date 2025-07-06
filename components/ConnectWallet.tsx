import { useState, useEffect } from 'react'
import { useConnect, useAccount, useDisconnect } from 'wagmi'
import { Address } from 'viem'
import { resolveL2PrimaryName, formatAddress, checkL2ContractExists } from '@/lib/ensUtils'
import SetPrimaryName from './SetPrimaryName'

interface EnsNameResult {
  name: string | null
  source: 'L2'
}

const ConnectWallet = () => {
  const { connect, connectors, isPending } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [ensResult, setEnsResult] = useState<EnsNameResult | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [showSetPrimaryName, setShowSetPrimaryName] = useState(false)
  const [l2ContractExists, setL2ContractExists] = useState<boolean | null>(null)

  // Check L2 contract existence on component mount
  useEffect(() => {
    const checkContract = async () => {
      const exists = await checkL2ContractExists()
      setL2ContractExists(exists)
    }
    checkContract()
  }, [])

  // Effect to resolve L2 primary name when address changes
  useEffect(() => {
    const resolveL2Name = async () => {
      if (!address) {
        setEnsResult(null)
        return
      }

      setIsResolving(true)

      try {
        // Get L2 primary name
        const l2Name = await resolveL2PrimaryName(address as Address)
        
        if (l2Name) {
          setEnsResult({
            name: l2Name,
            source: 'L2'
          })
        } else {
          setEnsResult(null)
        }
      } catch (error) {
        console.error('Error resolving L2 primary name:', error)
        setEnsResult(null)
      } finally {
        setIsResolving(false)
      }
    }

    resolveL2Name()
  }, [address])

  const handleConnect = (connector: any) => {
    connect({ connector })
  }

  const handleDisconnect = () => {
    disconnect()
    setEnsResult(null)
    setShowSetPrimaryName(false)
  }

  const handleSetPrimaryNameSuccess = () => {
    setShowSetPrimaryName(false)
    // Refresh L2 name resolution after setting primary name
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  }

  // Show SetPrimaryName component if user wants to set one
  if (showSetPrimaryName) {
    return (
      <SetPrimaryName
        onSuccess={handleSetPrimaryNameSuccess}
        onClose={() => setShowSetPrimaryName(false)}
      />
    )
  }

  if (isConnected && address) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Connected Wallet</h2>
          <button
            onClick={handleDisconnect}
            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
          >
            Disconnect
          </button>
        </div>

        <div className="space-y-4">
          {/* Address Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Address:</p>
            <p className="font-mono text-sm text-gray-800">{formatAddress(address)}</p>
            <p className="text-xs text-gray-500 mt-1 break-all">{address}</p>
          </div>

          {/* L2 Primary Name Display */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">L2 Primary Name:</p>
            {isResolving ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-500">Resolving...</span>
              </div>
            ) : ensResult?.name ? (
              <div className="space-y-2">
                <p className="font-semibold text-lg text-blue-600">{ensResult.name}</p>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                  {ensResult.source}
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="mb-2">No primary name set</p>
                {l2ContractExists === false ? (
                  <div className="p-2 bg-orange-50 rounded text-xs text-orange-700">
                    <strong>Note:</strong> L2 reverse registrar not yet deployed on Base Sepolia.
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSetPrimaryName(true)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium underline"
                  >
                    Set Primary Name on Base Sepolia
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Network Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Network:</p>
            <p className="text-sm text-gray-800">Base Sepolia Testnet</p>
            <p className="text-xs text-gray-500 mt-1">
              L2 primary names from Base Sepolia
            </p>
            {l2ContractExists === false && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠ L2 reverse registrar not available
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Connect Your Wallet</h2>
      <p className="text-gray-600 mb-6">
        Connect your wallet to see your L2 primary name on Base Sepolia
      </p>
      
      <div className="space-y-3">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {isPending ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              `Connect ${connector.name}`
            )}
          </button>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Features:</strong>
        </p>
        <ul className="text-sm text-blue-600 mt-2 space-y-1">
          <li>• L2 primary name resolution</li>
          <li>• Set primary names on Base Sepolia</li>
          <li>• Simple nameForAddr lookup</li>
        </ul>
      </div>
    </div>
  )
}

export default ConnectWallet 