import { useState, useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useRouter } from 'next/router'
import { Address } from 'viem'
import { resolveL2PrimaryName, formatAddress } from '@/lib/ensUtils'
import SetPrimaryName from '@/components/SetPrimaryName'
import dynamic from 'next/dynamic'
import Head from 'next/head'

// Dynamically import the wallet-connected dashboard to prevent hydration errors
const WalletConnectedDashboard = dynamic(() => import('@/components/WalletConnectedDashboard'), {
  ssr: false,
  loading: () => (
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
            <span className="text-lg" style={{ color: '#1b1b1b' }}>Loading Dashboard...</span>
          </div>
        </div>
      </div>
    </>
  ),
})

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  
  const [l2PrimaryName, setL2PrimaryName] = useState<string | null>(null)
  const [isResolvingName, setIsResolvingName] = useState(false)
  const [showSetPrimaryName, setShowSetPrimaryName] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

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

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted) {
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

  return <WalletConnectedDashboard />
} 