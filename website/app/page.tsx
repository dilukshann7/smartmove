import type { Metadata } from "next"

import { HomePage } from "@/components/home/home-page"

export const metadata: Metadata = {
  title: "SmartMove | Find your trip",
  description:
    "Search SmartMove trips, compare fares, choose seats and manage your bookings.",
}

export default function Page() {
  return <HomePage />
}
