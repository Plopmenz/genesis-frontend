"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createWeb3Modal } from "@web3modal/wagmi/react"
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config"
import { cookieStorage, createStorage, WagmiProvider } from "wagmi"
import { sepolia } from "wagmi/chains"

import { siteConfig } from "@/config/site"

export const chains = [sepolia] as const
export const defaultChain = sepolia

const appName = siteConfig.name
const appDescription = siteConfig.description
const appIcon = "https://genesis.plopmenz.com/icon.png" as const
const appUrl = "https://genesis.plopmenz.com" as const
const metadata = {
  name: appName,
  description: appDescription,
  url: appUrl,
  icons: [appIcon],
}

const projectId = "cc8d704986e6d4aeb3c86d09a34beb11" as const // WalletConnect
const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})

// Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
})

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient()

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
