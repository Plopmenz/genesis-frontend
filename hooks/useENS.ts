import { useEffect, useState } from "react"
import { Address } from "viem"
import { usePublicClient } from "wagmi"

export function useENS({ address }: { address?: Address }) {
  const [ens, setENS] = useState<string | undefined>(undefined)
  const publicClient = usePublicClient({ chainId: 1 })
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
