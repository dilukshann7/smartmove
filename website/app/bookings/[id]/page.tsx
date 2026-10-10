import type { Metadata } from "next"
import { BookingDetailsPage } from "@/components/bookings/booking-details-page"

export const metadata: Metadata = { title: "Booking status | SmartMove" }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <BookingDetailsPage bookingId={(await params).id} />
}
