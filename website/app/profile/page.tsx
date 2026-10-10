import type { Metadata } from "next"
import { ProfilePage } from "@/components/profile/profile-page"

export const metadata: Metadata = { title: "My profile | SmartMove" }
export default function Page() {
  return <ProfilePage />
}
