"use client"

import { useEffect, useState } from "react"
import { OpenmeshGenesisContract } from "@/genesis-indexer/contracts/OpenmeshGenesis"
import { tree } from "@/merkletree"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
  formatEther,
  Hex,
  parseEther,
} from "viem"
import { useAccount, usePublicClient, useWalletClient } from "wagmi"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

import { defaultChain } from "./web3-provider"

const formSchema = z.object({
  amount: z.string(),
})

enum CanMint {
  No,
  Public,
  Whitelist,
}

export function CreateMint({
  price,
  whitelist,
}: {
  price?: bigint
  whitelist?: { account: Address; mintFrom: number }
}) {
  const account = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "0",
    },
  })

  const [proof, setProof] = useState<Hex[]>([])
  useEffect(() => {
    if (!whitelist) {
      setProof([])
      return
    }

    const newProof = tree.getProof([whitelist.account, whitelist.mintFrom])
    setProof(newProof as Hex[])
  }, [whitelist])

  const [canMint, setCanMint] = useState<CanMint>(CanMint.No)
  const getCanMint = async () => {
    if (!publicClient || !account.address) {
      setCanMint(CanMint.No)
      return
    }

    const canPublicMint = await publicClient.readContract({
      abi: OpenmeshGenesisContract.abi,
      address: OpenmeshGenesisContract.address,
      functionName: "canPublicMint",
      args: [account.address],
    })
    if (canPublicMint) {
      // First try public, as it costs less gas
      setCanMint(CanMint.Public)
      return
    }

    if (whitelist) {
      const canWhitelistMint = await publicClient.readContract({
        abi: OpenmeshGenesisContract.abi,
        address: OpenmeshGenesisContract.address,
        functionName: "canWhitelistMint",
        args: [whitelist.account, proof, whitelist.mintFrom],
      })
      if (canWhitelistMint) {
        setCanMint(CanMint.Whitelist)
        return
      }
    }
  }

  useEffect(() => {
    getCanMint().catch(console.error)
  }, [publicClient, account.address, proof])

  useEffect(() => {
    form.setValue("amount", formatEther(price ?? BigInt(0)))
  }, [price])

  const [submitting, setSubmitting] = useState<boolean>(false)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (submitting) {
      toast({
        title: "Please wait",
        description: "The past mint is still running.",
        variant: "destructive",
      })
      return
    }
    let amount = BigInt(0)
    try {
      amount = parseEther(values.amount)
      if (price && amount < price) {
        toast({
          title: "Amount is not a valid number",
          description: `Amount has to be higher than the current price ${formatEther(price)}`,
          variant: "destructive",
        })
        return
      }
    } catch (err: any) {
      toast({
        title: "Amount is not a valid number",
        description: err?.message ?? err,
        variant: "destructive",
      })
      return
    }

    const submit = async () => {
      setSubmitting(true)
      let { dismiss } = toast({
        title: "Generating transaction",
        description: "Please sign the transaction in your wallet...",
      })

      if (!publicClient || !walletClient) {
        dismiss()
        toast({
          title: "Mint failed",
          description: `${publicClient ? "Wallet" : "Public"}Client is undefined.`,
          variant: "destructive",
        })
        return
      }
      const mintType =
        canMint === CanMint.Whitelist && whitelist
          ? ({
              functionName: "whitelistMint",
              args: [proof, whitelist.mintFrom],
            } as const)
          : ({
              functionName: "publicMint",
              args: [],
            } as const)
      const transactionRequest: any = await publicClient
        .simulateContract({
          account: walletClient.account.address,
          abi: OpenmeshGenesisContract.abi,
          address: OpenmeshGenesisContract.address,
          ...mintType,
          value: amount,
        })
        .catch((err) => {
          console.error(err)
          if (err instanceof BaseError) {
            let errorName = err.shortMessage ?? "Simulation failed."
            const revertError = err.walk(
              (err) => err instanceof ContractFunctionRevertedError
            )
            if (revertError instanceof ContractFunctionRevertedError) {
              errorName += ` -> ${revertError.data?.errorName}` ?? ""
            }
            return errorName
          }
          return "Simulation failed."
        })
      if (typeof transactionRequest === "string") {
        dismiss()
        toast({
          title: "Mint failed",
          description: transactionRequest,
          variant: "destructive",
        })
        return
      }
      const transactionHash = await walletClient
        .writeContract(transactionRequest.request)
        .catch((err) => {
          console.error(err)
          return undefined
        })
      if (!transactionHash) {
        dismiss()
        toast({
          title: "Mint failed",
          description: "Transaction rejected.",
          variant: "destructive",
        })
        return
      }

      dismiss()
      dismiss = toast({
        duration: 120_000, // 2 minutes
        title: "Mint transaction submitted",
        description: "Waiting until confirmed on the blockchain...",
        action: (
          <ToastAction
            altText="View on explorer"
            onClick={() => {
              window.open(
                `${defaultChain.blockExplorers.default.url}/tx/${transactionHash}`,
                "_blank"
              )
            }}
          >
            View on explorer
          </ToastAction>
        ),
      }).dismiss

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      })

      let mintSucceeded: boolean = false
      receipt.logs.forEach((log) => {
        try {
          if (
            log.address.toLowerCase() !==
            OpenmeshGenesisContract.address.toLowerCase()
          ) {
            // Only interested in logs originating from the tasks contract
            return
          }

          const taskCreatedEvent = decodeEventLog({
            abi: OpenmeshGenesisContract.abi,
            eventName: "Mint",
            topics: log.topics,
            data: log.data,
          })
          mintSucceeded = true
        } catch {}
      })
      if (!mintSucceeded) {
        dismiss()
        toast({
          title: "Error retrieving mint event",
          description: "The mint possibly failed.",
          variant: "destructive",
        })
        return
      }

      dismiss()
      dismiss = toast({
        title: "Success!",
        description: "The mint has succeeded.",
        variant: "success",
      }).dismiss
    }

    await submit().catch(console.error)
    setSubmitting(false)
  }

  return (
    <div className="grid grid-cols-1 gap-y-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={price ? formatEther(price) : "0"}
                    step={0.01}
                    {...field}
                    onChange={(change) => {
                      field.onChange(change)
                      form.trigger("amount")
                    }}
                  />
                </FormControl>
                <FormDescription>
                  As the price can change between you submitting the transaction
                  and it being confirmed on the blockchain, you can input the
                  maximum amount of ETH you are willing to pay for the mint. In
                  case the supplied ETH is under the current price, the
                  transaction will be reverted. Any surplus ETH will be returned
                  to your address.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={!canMint || submitting}>
            Mint
          </Button>
        </form>
      </Form>
    </div>
  )
}
