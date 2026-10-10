import type { Metadata } from "next"
import { DashboardPage } from "@/components/dashboard/dashboard-page"

export const metadata: Metadata = { title: "Passenger dashboard | SmartMove" }
export default function Page() {
  return <DashboardPage />
}
