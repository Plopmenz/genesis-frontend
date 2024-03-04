"use client"

import { useEffect, useState } from "react"
import { OpenmeshGenesisContract } from "@/genesis-indexer/contracts/OpenmeshGenesis"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  BaseError,
  ContractFunctionRevertedError,
  formatUnits,
  maxUint256,
  parseUnits,
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

export function CreateContribution({
  onContribute,
}: {
  onContribute: (amount: bigint) => Promise<void>
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

  const [contributed, setContributed] = useState<bigint | undefined>(undefined)
  const getContributed = async () => {
    if (!publicClient || !account.address) {
      setContributed(undefined)
      return
    }

    const totalContributed = await publicClient.readContract({
      abi: OpenmeshGenesisContract.abi,
      address: OpenmeshGenesisContract.address,
      functionName: "contributed",
      args: [account.address],
    })
    setContributed(totalContributed)
  }

  useEffect(() => {
    getContributed().catch(console.error)
  }, [publicClient, account.address])

  const [bounds, setBounds] = useState<{ min: bigint; max: bigint }>({
    min: BigInt(0),
    max: maxUint256,
  })
  const getBounds = async () => {
    if (!publicClient) {
      return
    }

    const contractBounds = await publicClient.multicall({
      contracts: [
        {
          abi: OpenmeshGenesisContract.abi,
          address: OpenmeshGenesisContract.address,
          functionName: "minWeiPerAccount",
        },
        {
          abi: OpenmeshGenesisContract.abi,
          address: OpenmeshGenesisContract.address,
          functionName: "maxWeiPerAccount",
        },
      ],
      allowFailure: false,
    })
    setBounds({ min: contractBounds[0], max: contractBounds[1] })
  }

  useEffect(() => {
    getBounds().catch(console.error)
  }, [publicClient])

  const minBound = contributed
    ? contributed < bounds.min
      ? bounds.min - contributed
      : BigInt(0)
    : bounds.min
  const maxBound = contributed
    ? contributed < bounds.max
      ? bounds.max - contributed
      : BigInt(0)
    : bounds.max

  useEffect(() => {
    form.setValue(
      "amount",
      formatUnits(maxBound, defaultChain.nativeCurrency.decimals)
    )
  }, [maxBound])

  const [submitting, setSubmitting] = useState<boolean>(false)
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (submitting) {
      toast({
        title: "Please wait",
        description: "The past submission is still running.",
        variant: "destructive",
      })
      return
    }
    let amount = BigInt(0)
    try {
      amount = parseUnits(values.amount, defaultChain.nativeCurrency.decimals)
      if (amount === BigInt(0)) {
        toast({
          title: "Amount is not a valid number",
          description: "Cannot contribute 0",
          variant: "destructive",
        })
        return
      }
      if (amount < minBound || amount > maxBound) {
        toast({
          title: "Amount is not a valid number",
          description: `Amount has to be between ${formatUnits(minBound, defaultChain.nativeCurrency.decimals)} and ${formatUnits(maxBound, defaultChain.nativeCurrency.decimals)}`,
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
          title: "Contribution failed",
          description: `${publicClient ? "Wallet" : "Public"}Client is undefined.`,
          variant: "destructive",
        })
        return
      }
      const transactionRequest = await publicClient
        .prepareTransactionRequest({
          account: walletClient.account.address,
          to: OpenmeshGenesisContract.address,
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
          title: "Contribution failed",
          description: transactionRequest,
          variant: "destructive",
        })
        return
      }
      const transactionHash = await walletClient
        .sendTransaction(transactionRequest)
        .catch((err) => {
          console.error(err)
          return undefined
        })
      if (!transactionHash) {
        dismiss()
        toast({
          title: "Contribution failed",
          description: "Transaction rejected.",
          variant: "destructive",
        })
        return
      }

      dismiss()
      dismiss = toast({
        duration: 120_000, // 2 minutes
        title: "Contribution transaction submitted",
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

      dismiss()
      dismiss = toast({
        title: "Success!",
        description: "The contribution has been made.",
        variant: "success",
        action: (
          <ToastAction
            altText="Refresh"
            onClick={() => {
              getContributed().catch(console.error)
              onContribute(amount)
            }}
          >
            Refresh
          </ToastAction>
        ),
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
                    disabled={
                      contributed !== undefined && contributed >= maxBound
                    }
                    min={formatUnits(
                      minBound,
                      defaultChain.nativeCurrency.decimals
                    )}
                    max={formatUnits(
                      maxBound,
                      defaultChain.nativeCurrency.decimals
                    )}
                    step={0.01}
                    {...field}
                    onChange={(change) => {
                      field.onChange(change)
                      form.trigger("amount")
                    }}
                  />
                </FormControl>
                <FormDescription>
                  How much ETH you would like to contribute. (Minimum total of{" "}
                  {formatUnits(
                    bounds.min,
                    defaultChain.nativeCurrency.decimals
                  )}{" "}
                  ETH, Maximum total of{" "}
                  {formatUnits(
                    bounds.max,
                    defaultChain.nativeCurrency.decimals
                  )}{" "}
                  ETH). Contributing a total of{" "}
                  {formatUnits(
                    bounds.max,
                    defaultChain.nativeCurrency.decimals
                  )}{" "}
                  ETH will grant you the Openmesh Genesis Validator Pass.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={submitting}>
            Contribute
          </Button>
        </form>
      </Form>
      {contributed !== undefined && (
        <span>
          You have contributed:{" "}
          {formatUnits(contributed, defaultChain.nativeCurrency.decimals)} ETH
        </span>
      )}
    </div>
  )
}
