import type { Metadata } from "next"
import { TicketPage } from "@/components/tickets/ticket-page"

export const metadata: Metadata = { title: "Issued ticket | SmartMove" }
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <TicketPage ticketId={(await params).id} />
}
