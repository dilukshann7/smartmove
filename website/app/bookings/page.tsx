import type { Metadata } from "next"
import { BookingsPage } from "@/components/bookings/bookings-page"

export const metadata: Metadata = { title: "My bookings | SmartMove" }

export default function Page() {
  return <BookingsPage />
}
