"use client"

import { useEffect, useState } from "react"
import { TotalMintsReturn } from "@/genesis-indexer/api/return-types"
import { OpenmeshGenesisContract } from "@/genesis-indexer/contracts/OpenmeshGenesis"
import { reviver } from "@/genesis-indexer/utils/json"
import { rawTree } from "@/merkletree"
import axios from "axios"
import { Address } from "viem"
import { useAccount, useBlockNumber, usePublicClient } from "wagmi"

import { FromBlockchainDate } from "@/lib/timeUnits"
import { Separator } from "@/components/ui/separator"

import { Button } from "../ui/button"
import { CreateMint } from "./create-mint"
import { ShowMint } from "./show-mint"

export function Mint() {
  const account = useAccount()
  const publicClient = usePublicClient()
  const { data: blocknumber } = useBlockNumber({ watch: true })

  const [mintCount, setMintCount] = useState<number>(0)
  const [showMintCount, setShowMintCount] = useState<number>(25)

  const [mints, setMints] = useState<bigint | undefined>(undefined)
  const [price, setPrice] = useState<bigint | undefined>(undefined)
  const [whitelist, setWhitelist] = useState<
    { account: Address; mintFrom: number } | undefined
  >(undefined)
  const [publicMint, setPublicMint] = useState<number | undefined>(undefined)

  const getMintCount = async () => {
    const response = await axios.get("/indexer/totalMint")
    if (response.status !== 200) {
      throw new Error(`Fetching mint count error: ${response.data}`)
    }
    const newMintCount = JSON.parse(
      JSON.stringify(response.data),
      reviver
    ) as TotalMintsReturn
    setMintCount(newMintCount.totalMints)
  }

  useEffect(() => {
    getMintCount().catch(console.error)
  }, [mints])

  useEffect(() => {
    const getMints = async () => {
      if (!publicClient) {
        setMints(undefined)
        return
      }

      const newMints = await publicClient.readContract({
        abi: OpenmeshGenesisContract.abi,
        address: OpenmeshGenesisContract.address,
        functionName: "mintCount",
      })
      setMints(newMints)
    }

    getMints().catch(console.error)
  }, [publicClient, blocknumber])

  useEffect(() => {
    const getPrice = async () => {
      if (!publicClient) {
        setPrice(undefined)
        return
      }

      const newPrice = await publicClient.readContract({
        abi: OpenmeshGenesisContract.abi,
        address: OpenmeshGenesisContract.address,
        functionName: "getCurrentPrice",
      })
      setPrice(newPrice)
    }

    getPrice().catch(console.error)
  }, [publicClient, mints])

  useEffect(() => {
    const whitelist = rawTree.values.find(
      (v) =>
        (v.value[0] as Address).toLowerCase() === account.address?.toLowerCase()
    )
    setWhitelist(
      whitelist
        ? {
            account: whitelist.value[0] as Address,
            mintFrom: whitelist.value[1] as number,
          }
        : undefined
    )
  }, [account.address])

  useEffect(() => {
    const getPublicMint = async () => {
      if (!publicClient || !account.address) {
        setPublicMint(undefined)
        return
      }

      const newPublicMint = await publicClient.readContract({
        abi: OpenmeshGenesisContract.abi,
        address: OpenmeshGenesisContract.address,
        functionName: "publicMintTime",
      })
      setPublicMint(newPublicMint)
    }

    getPublicMint().catch(console.error)
  }, [publicClient, account.address])

  const blockchainMintDate = whitelist?.mintFrom ?? publicMint
  const mintDate = blockchainMintDate
    ? FromBlockchainDate(blockchainMintDate)
    : undefined

  return (
    <div className="grid grid-cols-1 gap-y-3">
      <CreateMint price={price} whitelist={whitelist} />
      <Separator />
      <div>
        {mints === BigInt(2000) ? (
          <span>The mint is over.</span>
        ) : !mintDate ? (
          <div></div>
        ) : mintDate > new Date() ? (
          <span>You can mint from {mintDate.toDateString()}.</span>
        ) : (
          <span>Current price: {price?.toString()} ETH</span>
        )}
        {/* {periods.map((period, i) => (
          <div key={i}>
            <span>
              From {period.start.toDateString()} to {period.end.toDateString()}:{" "}
              {period.rate.toString()} OPEN/ETH
            </span>
          </div>
        ))} */}
      </div>
      <Separator />
      {Array.from({ length: mintCount }, (x, i) => i)
        .reverse()
        .slice(0, showMintCount)
        .map((contributionIndex, i) => (
          <ShowMint key={i} index={contributionIndex} />
        ))}
      {showMintCount < mintCount && (
        <Button
          onClick={() => {
            setShowMintCount(showMintCount + 25)
          }}
        >
          Show more
        </Button>
      )}
    </div>
  )
}
