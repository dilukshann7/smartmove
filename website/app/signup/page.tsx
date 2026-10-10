import type { Metadata } from "next"
import { AuthPage } from "@/components/auth/auth-page"

export const metadata: Metadata = { title: "Create account | SmartMove" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  return <AuthPage mode="signup" nextPath={(await searchParams).next} />
}
