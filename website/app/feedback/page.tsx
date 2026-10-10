import type { Metadata } from "next"
import { FeedbackPage } from "@/components/feedback/feedback-page"

export const metadata: Metadata = { title: "Feedback | SmartMove" }
export default function Page() {
  return <FeedbackPage />
}
