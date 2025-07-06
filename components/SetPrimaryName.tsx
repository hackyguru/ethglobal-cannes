import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { 
  BASE_SEPOLIA_REVERSE_REGISTRAR, 
  REVERSE_REGISTRAR_WRITE_ABI,
  resolveL2PrimaryName,
  generateSignatureData,
  createSignatureExpiry,
  isValidEnsName,
  BASE_COINTYPE,
  checkL2ContractExists,
  verifyBaseSepoliaNetwork
} from '../lib/ensUtils'

interface SetPrimaryNameProps {
  onSuccess?: () => void
  onClose?: () => void
}

const SetPrimaryName: React.FC<SetPrimaryNameProps> = ({ onSuccess, onClose }) => {
  const { address: userAddress } = useAccount()
  const [nameToSet, setNameToSet] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [networkInfo, setNetworkInfo] = useState<{ chainId: number; isCorrect: boolean } | null>(null)
  
  const { writeContract, data: hash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { switchChain } = useSwitchChain()
  
  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed,
    data: transactionReceipt
  } = useWaitForTransactionReceipt({
    hash,
  })

  // Check network status on component mount
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const network = await verifyBaseSepoliaNetwork()
        setNetworkInfo(network)
        
        if (!network.isCorrect) {
          setMessage(`Network verification: Using chain ${network.chainId}, expected ${baseSepolia.id} (Base Sepolia)`)
          setMessageType('error')
        }
      } catch (error) {
        console.error('Network check failed:', error)
        setMessage('Failed to verify network status')
        setMessageType('error')
      }
    }
    
    checkNetwork()
  }, [])

  // Show transaction hash when available
  useEffect(() => {
    if (hash) {
      setTransactionHash(hash)
      setMessage(`Transaction submitted: ${hash}`)
      setMessageType('info')
    }
  }, [hash])

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && transactionReceipt) {
      handleTransactionSuccess()
    }
  }, [isConfirmed, transactionReceipt])

  const handleTransactionSuccess = async () => {
    setIsLoading(true)
    
    try {
      // Add comprehensive debug info
      const debugData = {
        transactionHash: transactionReceipt?.transactionHash,
        blockNumber: transactionReceipt?.blockNumber,
        status: transactionReceipt?.status,
        gasUsed: transactionReceipt?.gasUsed?.toString(),
        logs: transactionReceipt?.logs?.length || 0,
        events: transactionReceipt?.logs?.map(log => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
        })) || [],
        networkInfo,
        contractAddress: BASE_SEPOLIA_REVERSE_REGISTRAR,
        nameToSet,
        userAddress: userAddress,
        timestamp: new Date().toISOString(),
      }
      
      setDebugInfo(debugData)
      
      // Check transaction status
      if (transactionReceipt?.status === 'success') {
        setMessage('Transaction confirmed! Checking if name was set...')
        setMessageType('info')
        
        // Check if the name was actually set with multiple attempts
        let nameSet = false
        let attempts = 0
        const maxAttempts = 3
        const delays = [0, 5000, 10000] // 0s, 5s, 10s
        
        while (!nameSet && attempts < maxAttempts) {
          if (attempts > 0) {
            setMessage(`Checking attempt ${attempts + 1}/${maxAttempts}... (waiting ${delays[attempts]/1000}s)`)
            await new Promise(resolve => setTimeout(resolve, delays[attempts]))
          }
          
          const currentName = await resolveL2PrimaryName(userAddress as `0x${string}`)
          console.log(`Check attempt ${attempts + 1} - Current L2 name:`, currentName)
          
          if (currentName && currentName.toLowerCase() === nameToSet.toLowerCase()) {
            nameSet = true
            setMessage('✅ Primary name set successfully!')
            setMessageType('success')
            onSuccess?.()
            break
          }
          
          attempts++
        }
        
        if (!nameSet) {
          setMessage(`Name setting completed but may need more time to propagate. Transaction was successful.`)
          setMessageType('info')
          setShowDebugInfo(true)
          
          // Add verification debug info
          const verificationDebug = {
            ...debugData,
            checkAttempts: attempts,
            lastResolvedName: await resolveL2PrimaryName(userAddress as `0x${string}`),
            expectedName: nameToSet,
          }
          setDebugInfo(verificationDebug)
        }
      } else {
        setMessage('❌ Transaction failed')
        setMessageType('error')
        setShowDebugInfo(true)
      }
      
    } catch (error) {
      console.error('Error in transaction success handler:', error)
      setMessage(`Error checking transaction: ${error}`)
      setMessageType('error')
      setShowDebugInfo(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetName = async () => {
    if (!userAddress || !nameToSet) return
    
    setIsLoading(true)
    setMessage('')
    setTransactionHash(null)
    setDebugInfo(null)
    setShowDebugInfo(false)
    
    try {
      // Verify network first
      const network = await verifyBaseSepoliaNetwork()
      setNetworkInfo(network)
      
      if (!network.isCorrect) {
        setMessage(`❌ Network error: Connected to chain ${network.chainId}, need Base Sepolia (${baseSepolia.id})`)
        setMessageType('error')
        setIsLoading(false)
        return
      }
      
      // Validate ENS name
      if (!isValidEnsName(nameToSet)) {
        setMessage('❌ Invalid ENS name format')
        setMessageType('error')
        setIsLoading(false)
        return
      }

      // Check if contract exists
      const contractExists = await checkL2ContractExists()
      if (!contractExists) {
        setMessage('❌ L2 reverse registrar contract not found on Base Sepolia')
        setMessageType('error')
        setIsLoading(false)
        return
      }

      // Switch to Base Sepolia if needed
      try {
        await switchChain({ chainId: baseSepolia.id })
      } catch (error) {
        console.error('Chain switch failed:', error)
        setMessage('❌ Failed to switch to Base Sepolia network')
        setMessageType('error')
        setIsLoading(false)
        return
      }

      setMessage('Setting primary name...')
      setMessageType('info')

      // First try simple setName method
      try {
        await writeContract({
          address: BASE_SEPOLIA_REVERSE_REGISTRAR,
          abi: REVERSE_REGISTRAR_WRITE_ABI,
          functionName: 'setName',
          args: [nameToSet],
        })
        return
      } catch (error) {
        console.log('Simple setName failed, trying signature method:', error)
      }

      // Fallback to signature method
      try {
        const signatureExpiry = createSignatureExpiry()
        const coinTypes = [BigInt(BASE_COINTYPE)]
        
        // Generate signature data
        const signatureData = generateSignatureData(
          nameToSet,
          userAddress as `0x${string}`,
          coinTypes,
          signatureExpiry
        )
        
        // Request signature from user
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [signatureData, userAddress],
        })
        
        await writeContract({
          address: BASE_SEPOLIA_REVERSE_REGISTRAR,
          abi: REVERSE_REGISTRAR_WRITE_ABI,
          functionName: 'setNameForAddrWithSignature',
          args: [
            userAddress as `0x${string}`,
            nameToSet,
            coinTypes,
            signatureExpiry,
            signature as `0x${string}`,
          ],
        })
        
      } catch (error) {
        console.error('Signature method failed:', error)
        setMessage('❌ Failed to set primary name with signature method')
        setMessageType('error')
        setIsLoading(false)
        return
      }

    } catch (error) {
      console.error('Error setting name:', error)
      setMessage(`❌ Error: ${error}`)
      setMessageType('error')
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Set L2 Primary Name</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Network Status */}
      {networkInfo && (
        <div className={`mb-4 p-3 rounded-lg ${
          networkInfo.isCorrect 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              networkInfo.isCorrect ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span className={`text-sm font-medium ${
              networkInfo.isCorrect ? 'text-green-800' : 'text-red-800'
            }`}>
              Network: Chain {networkInfo.chainId} 
              {networkInfo.isCorrect ? ' (Base Sepolia ✓)' : ` (Expected: ${baseSepolia.id})`}
            </span>
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ENS Name
        </label>
        <input
          type="text"
          value={nameToSet}
          onChange={(e) => setNameToSet(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="yourname.eth"
        />
      </div>
      
      <button
        onClick={handleSetName}
        disabled={isLoading || isWritePending || isConfirming || !nameToSet}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading || isWritePending || isConfirming ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            {isWritePending ? 'Preparing...' : isConfirming ? 'Confirming...' : 'Processing...'}
          </span>
        ) : (
          'Set Primary Name'
        )}
      </button>
      
      {/* Status Messages */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg ${
          messageType === 'success' ? 'bg-green-50 border border-green-200' :
          messageType === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`text-sm ${
            messageType === 'success' ? 'text-green-800' :
            messageType === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {message}
          </p>
        </div>
      )}
      
      {/* Transaction Hash */}
      {transactionHash && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 mb-2">
            <strong>Transaction Hash:</strong>
          </p>
          <p className="text-xs font-mono bg-white p-2 rounded border break-all">
            {transactionHash}
          </p>
          <a
            href={`https://sepolia.basescan.org/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
          >
            View on BaseScan →
          </a>
        </div>
      )}
      
      {/* Debug Info */}
      {debugInfo && (
        <div className="mt-4">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            {showDebugInfo ? 'Hide' : 'Show'} Debug Info
          </button>
          
          {showDebugInfo && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SetPrimaryName 