import { useState, useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { Address } from 'viem'
import { 
  BASE_SEPOLIA_REVERSE_REGISTRAR, 
  checkL2ContractExists, 
  resolveL2PrimaryName, 
  baseSepoliaClient 
} from '@/lib/ensUtils'

const ContractDiagnostics = () => {
  const { address } = useAccount()
  const chainId = useChainId()
  const [diagnostics, setDiagnostics] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    if (!address) return
    
    setLoading(true)
    const results: any = {}
    
    try {
      // Check if contract exists
      results.contractExists = await checkL2ContractExists()
      
      // Get contract bytecode
      try {
        const code = await baseSepoliaClient.getCode({
          address: BASE_SEPOLIA_REVERSE_REGISTRAR,
        })
        results.contractCode = code ? `${code.slice(0, 20)}...` : 'No code'
      } catch (error) {
        results.contractCode = `Error: ${error}`
      }
      
      // Try to call name() function
      try {
        const name = await resolveL2PrimaryName(address as Address)
        results.nameCall = name || 'No name set'
      } catch (error: any) {
        results.nameCall = `Error: ${error.message}`
      }
      
      // Check network
      results.network = chainId
      results.expectedNetwork = baseSepolia.id
      results.correctNetwork = chainId === baseSepolia.id
      
      // Contract address
      results.contractAddress = BASE_SEPOLIA_REVERSE_REGISTRAR
      
    } catch (error) {
      results.error = error
    }
    
    setDiagnostics(results)
    setLoading(false)
  }

  useEffect(() => {
    if (address) {
      runDiagnostics()
    }
  }, [address, chainId])

  if (!address) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-gray-600">Connect wallet to run diagnostics</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Contract Diagnostics</h2>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm"
        >
          {loading ? 'Running...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(diagnostics).map(([key, value]) => (
          <div key={key} className="border-l-4 border-blue-200 pl-4">
            <p className="font-semibold text-gray-700 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}:
            </p>
            <p className={`text-sm ${
              key === 'contractExists' && !value ? 'text-red-600' :
              key === 'correctNetwork' && !value ? 'text-red-600' :
              key.includes('Error') || String(value).includes('Error') ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : String(value)}
            </p>
          </div>
        ))}
      </div>

      {diagnostics.contractExists === false && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">
            <strong>Contract not found:</strong> The L2 reverse registrar contract may not be deployed on Base Sepolia yet. 
            This is expected for testnet contracts that are still in development.
          </p>
        </div>
      )}

      {diagnostics.correctNetwork === false && (
        <div className="mt-4 p-4 bg-orange-50 rounded-lg">
          <p className="text-sm text-orange-700">
            <strong>Wrong network:</strong> Switch to Base Sepolia (Chain ID: {baseSepolia.id}) to test the L2 contract.
          </p>
        </div>
      )}
    </div>
  )
}

export default ContractDiagnostics 