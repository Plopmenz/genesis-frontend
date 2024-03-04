// Various time units per Solidity spec

export const seconds = 1
export const minutes = 60 * seconds
export const hours = 60 * minutes
export const days = 24 * hours
export const week = 7 * days
export function now() {
  return ToBlockchainDate(new Date())
}

export function ToBlockchainDate(date: Date): number {
  return Math.round(date.getTime() / 1000)
}

export function FromBlockchainDate(date: bigint | number): Date {
  let jsDate = new Date()
  jsDate.setTime(Number(date) * 1000)
  return jsDate
}

export function UTCBlockchainDate(
  utcYear: number,
  utcMonth: number,
  utcDay: number
): number {
  return Math.round(Date.UTC(utcYear, utcMonth - 1, utcDay) / 1000)
}
