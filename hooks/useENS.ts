import { useEffect, useState } from "react"
import { Address, createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"

export function useENS({ address }: { address?: Address }) {
  const [ens, setENS] = useState<string | undefined>(undefined)
  const [publicClient, _] = useState(
    createPublicClient({
      chain: mainnet,
      transport: http(),
    })
  )
  useEffect(() => {
    const getENS = async () => {
      if (!address || !publicClient) {
        setENS(undefined)
        return
      }

      const ensName = await publicClient.getEnsName({ address: address })
      setENS(ensName ?? undefined)
    }

    getENS().catch(console.error)
  }, [address, publicClient])
  return ens
}
