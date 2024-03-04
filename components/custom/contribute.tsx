"use client"

import { useEffect, useState } from "react"
import { TotalContributionsReturn } from "@/genesis-indexer/api/return-types"
import { OpenmeshGenesisContract } from "@/genesis-indexer/contracts/OpenmeshGenesis"
import { reviver } from "@/genesis-indexer/utils/json"
import axios from "axios"
import { usePublicClient } from "wagmi"

import { FromBlockchainDate } from "@/lib/timeUnits"
import { Separator } from "@/components/ui/separator"

import { Button } from "../ui/button"
import { CreateContribution } from "./create-contribution"
import { ShowContribution } from "./show-contribution"

export function Contribute() {
  const publicClient = usePublicClient()
  const [contributionCount, setContributionCount] = useState<number>(0)
  const [showContributionCount, setShowContributionCount] = useState<number>(25)
  const [tokenRate, setTokenRate] = useState<bigint | undefined>(undefined)
  const [periods, setPeriods] = useState<
    { start: Date; end: Date; rate: bigint }[]
  >([])

  const getContributionCount = async () => {
    const response = await axios.get("/indexer/totalContributions")
    if (response.status !== 200) {
      throw new Error(`Fetching contribution count error: ${response.data}`)
    }
    const newContribubtionCount = JSON.parse(
      JSON.stringify(response.data),
      reviver
    ) as TotalContributionsReturn
    setContributionCount(newContribubtionCount.totalContributions)
  }

  useEffect(() => {
    getContributionCount().catch(console.error)
  }, [])

  useEffect(() => {
    const getTokenRate = async () => {
      if (!publicClient) {
        setTokenRate(undefined)
        return
      }

      const rate = await publicClient.readContract({
        abi: OpenmeshGenesisContract.abi,
        address: OpenmeshGenesisContract.address,
        functionName: "tokensPerWei",
      })
      setTokenRate(rate)
    }

    getTokenRate().catch(console.error)
  }, [publicClient])

  useEffect(() => {
    const getPeriods = async () => {
      if (!publicClient) {
        setPeriods([])
        return
      }

      const periodsInfo = await publicClient.multicall({
        contracts: [
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "start",
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "periodEnds",
            args: [BigInt(0)],
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "tokensPerWeiPerPeriod",
            args: [BigInt(0)],
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "periodEnds",
            args: [BigInt(1)],
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "tokensPerWeiPerPeriod",
            args: [BigInt(1)],
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "periodEnds",
            args: [BigInt(2)],
          },
          {
            abi: OpenmeshGenesisContract.abi,
            address: OpenmeshGenesisContract.address,
            functionName: "tokensPerWeiPerPeriod",
            args: [BigInt(2)],
          },
        ],
        allowFailure: false,
      })

      setPeriods([
        {
          start: FromBlockchainDate(periodsInfo[0]),
          end: FromBlockchainDate(periodsInfo[1]),
          rate: periodsInfo[2],
        },
        {
          start: FromBlockchainDate(periodsInfo[1]),
          end: FromBlockchainDate(periodsInfo[3]),
          rate: periodsInfo[4],
        },
        {
          start: FromBlockchainDate(periodsInfo[3]),
          end: FromBlockchainDate(periodsInfo[5]),
          rate: periodsInfo[6],
        },
      ])
    }

    getPeriods().catch(console.error)
  }, [publicClient])

  return (
    <div className="grid grid-cols-1 gap-y-3">
      <CreateContribution
        onContribute={async () => {
          await getContributionCount().catch(console.error)
        }}
      />
      <Separator />
      <div>
        {periods.length === 0 ? (
          <div></div>
        ) : periods[0].start > new Date() ? (
          <span>Genesis event starts {periods[0].start.toDateString()}.</span>
        ) : periods[periods.length - 1].end < new Date() ? (
          <span>
            Genesis event ended {periods[periods.length - 1].end.toDateString()}
            .
          </span>
        ) : (
          <span>Current rate: {tokenRate?.toString()} OPEN/ETH</span>
        )}
        {periods.map((period, i) => (
          <div key={i}>
            <span>
              From {period.start.toDateString()} to {period.end.toDateString()}:{" "}
              {period.rate.toString()} OPEN/ETH
            </span>
          </div>
        ))}
      </div>
      <Separator />
      {Array.from({ length: contributionCount }, (x, i) => i)
        .reverse()
        .slice(0, showContributionCount)
        .map((contributionIndex, i) => (
          <ShowContribution key={i} index={contributionIndex} />
        ))}
      {showContributionCount < contributionCount && (
        <Button
          onClick={() => {
            setShowContributionCount(showContributionCount + 25)
          }}
        >
          Show more
        </Button>
      )}
    </div>
  )
}
