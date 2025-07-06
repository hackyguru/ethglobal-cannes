import { createConfig, http } from 'wagmi'
import { mainnet, baseSepolia } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

// WalletConnect project ID (you can get this from https://cloud.walletconnect.com)
const projectId = 'YOUR_PROJECT_ID'

export const config = createConfig({
  chains: [mainnet, baseSepolia],
  connectors: [
    injected(),
    metaMask(),
    // walletConnect can be added later with project ID
  ],
  transports: {
    [mainnet.id]: http('https://ethereum.publicnode.com'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
}) 