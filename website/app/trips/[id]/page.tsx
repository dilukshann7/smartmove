import type { Metadata } from "next"
import { TripDetailsPage } from "@/components/trips/trip-details-page"

export const metadata: Metadata = { title: "Trip details | SmartMove" }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <TripDetailsPage tripId={(await params).id} />
}
