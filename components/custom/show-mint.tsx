"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { MintReturn } from "@/genesis-indexer/api/return-types"
import { reviver } from "@/genesis-indexer/utils/json"
import axios from "axios"
import { formatEther } from "viem"

import { useENS } from "@/hooks/useENS"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { defaultChain } from "./web3-provider"

export function ShowMint({ index }: { index: number }) {
  const [mint, setMint] = useState<MintReturn | undefined>(undefined)

  useEffect(() => {
    const getContribution = async () => {
      const response = await axios.get(`/indexer/mint/${index}`)
      if (response.status !== 200) {
        throw new Error(`Fetching mint ${index} error: ${response.data}`)
      }
      const newMint = JSON.parse(
        JSON.stringify(response.data),
        reviver
      ) as MintReturn
      setMint(newMint)
    }

    getContribution().catch(console.error)
  }, [index])

  const contributorENS = useENS({ address: mint?.account })

  if (!mint) {
    return <div></div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contributorENS ?? mint.account}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-y-1">
        <span>Paid {formatEther(mint.paid)} ETH.</span>
      </CardContent>
      <CardFooter>
        <Link
          href={`${defaultChain.blockExplorers.default.url}/tx/${mint.transactionHash}`}
          target="_blank"
          className={buttonVariants({ variant: "default" })}
        >
          View on explorer
        </Link>
      </CardFooter>
    </Card>
  )
}
