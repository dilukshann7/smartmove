import type { ReactNode } from "react"
import { PassengerGate } from "@/components/auth/passenger-gate"

export default function Layout({ children }: { children: ReactNode }) {
  return <PassengerGate>{children}</PassengerGate>
}
