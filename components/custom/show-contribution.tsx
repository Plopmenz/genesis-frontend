"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ContributionReturn } from "@/genesis-indexer/api/return-types"
import { reviver } from "@/genesis-indexer/utils/json"
import axios from "axios"
import { formatUnits } from "viem"

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

export function ShowContribution({ index }: { index: number }) {
  const [contribution, setContribution] = useState<
    ContributionReturn | undefined
  >(undefined)

  useEffect(() => {
    const getContribution = async () => {
      const response = await axios.get(`/indexer/contribution/${index}`)
      if (response.status !== 200) {
        throw new Error(
          `Fetching contribution ${index} error: ${response.data}`
        )
      }
      const newContribubtion = JSON.parse(
        JSON.stringify(response.data),
        reviver
      ) as ContributionReturn
      setContribution(newContribubtion)
    }

    getContribution().catch(console.error)
  }, [index])

  const contributorENS = useENS({ address: contribution?.from })

  if (!contribution) {
    return <div></div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contributorENS ?? contribution.from}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-y-1">
        <span>
          Contributed{" "}
          {formatUnits(
            contribution.amount,
            defaultChain.nativeCurrency.decimals
          )}{" "}
          ETH.
        </span>
        <span>Recieved {formatUnits(contribution.givenTokens, 18)} OPEN.</span>
        {contribution.givenNFT && (
          <span>Recieved a Genesis Validator Pass.</span>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href={`${defaultChain.blockExplorers.default.url}/tx/${contribution.transactionHash}`}
          target="_blank"
          className={buttonVariants({ variant: "default" })}
        >
          View on explorer
        </Link>
      </CardFooter>
    </Card>
  )
}
