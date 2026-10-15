import type { Metadata } from "next"
import { AdminGate } from "@/components/auth/admin-gate"

export const metadata: Metadata = { title: "Admin workspace | SmartMove" }
export default function Page() { return <AdminGate /> }
