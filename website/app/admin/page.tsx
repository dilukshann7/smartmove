import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { AdminPage } from "@/components/admin/admin-page"
import { ADMIN_COOKIE, getAdminByToken } from "@/lib/server/admin-auth"
import { getConnection } from "@/lib/server/oracle"

export const metadata: Metadata = { title: "Admin workspace | SmartMove" }

export default async function Page() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  const connection = await getConnection()
  let admin
  try {
    admin = await getAdminByToken(connection, token)
  } finally {
    await connection.close()
  }
  if (!admin) redirect("/login?next=%2Fadmin")
  return <AdminPage email={admin.email} />
}
