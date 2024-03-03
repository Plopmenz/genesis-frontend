"use client"

import { useEffect, useState } from "react"
import { TotalContributionsReturn } from "@/genesis-indexer/api/return-types"
import { reviver } from "@/genesis-indexer/utils/json"
import axios from "axios"

import { Separator } from "@/components/ui/separator"

import { Button } from "../ui/button"
import { CreateContribution } from "./create-contribution"
import { ShowContribution } from "./show-contribution"

export function Contribute() {
  const [contributionCount, setContributionCount] = useState<number>(0)
  const [showContributionCount, setShowContributionCount] = useState<number>(25)

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

  return (
    <div className="grid grid-cols-1 gap-y-3">
      <CreateContribution
        onContribute={async () => {
          await getContributionCount()
        }}
      />
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
