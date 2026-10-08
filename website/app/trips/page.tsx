import type { Metadata } from "next"
import { TripsPage } from "@/components/trips/trips-page"

export const metadata: Metadata = { title: "Find trips | SmartMove" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    origin?: string
    destination?: string
    date?: string
  }>
}) {
  const search = await searchParams
  return <TripsPage key={JSON.stringify(search)} initialSearch={search} />
}
