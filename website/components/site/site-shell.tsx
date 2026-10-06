"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { ArrowUpRight, Menu, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function SiteShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [passenger, setPassenger] = useState<{ name: string } | null>(null)
  const [admin, setAdmin] = useState<{ email: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setPassenger(data?.passenger ?? null)
        setAdmin(data?.admin ?? null)
      })
      .catch(() => {
        setPassenger(null)
        setAdmin(null)
      })
  }, [])

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" })
    if (response.ok) {
      setPassenger(null)
      setAdmin(null)
      setMenuOpen(false)
      router.push("/")
      router.refresh()
    }
  }

  const links = [
    { href: "/", label: "Home" },
    { href: "/trips", label: "Find a trip" },
    ...(admin ? [{ href: "/admin", label: "Admin workspace" }] : []),
    ...(passenger
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/bookings", label: "My bookings" },
          { href: "/feedback", label: "Feedback" },
          { href: "/profile", label: "Profile" },
        ]
      : []),
  ]
  const isActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="smartmove-home smartmove-workspace">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="smartmove-header">
        <div className="smartmove-nav">
          <Link
            href="/"
            className="smartmove-brand"
            aria-label="SmartMove home"
          >
            <span className="smartmove-brand-mark">
              <Route className="size-5" aria-hidden="true" />
            </span>
            <span>
              SmartMove<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 xl:flex"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className="smartmove-nav-link"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-4 xl:flex">
            {passenger || admin ? (
              <>
                <span className="smartmove-account-name">
                  <span className="smartmove-account-avatar" aria-hidden="true">
                    {(passenger?.name ?? admin?.email ?? "S")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="max-w-32 truncate">
                    {passenger?.name ?? admin?.email}
                  </span>
                </span>
                <Button
                  variant="outline"
                  className="rounded-full bg-white/70 px-4"
                  onClick={logout}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="smartmove-nav-link">
                  Sign in
                </Link>
                <Link href="/signup" className="smartmove-dark-button">
                  Get started{" "}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              aria-label="Open navigation"
              className="smartmove-menu-button xl:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="smartmove-mobile-sheet w-[min(85vw,360px)]"
            >
              <SheetHeader>
                <SheetTitle>SmartMove.</SheetTitle>
              </SheetHeader>
              <nav
                aria-label="Mobile navigation"
                className="flex flex-col gap-2 p-4"
              >
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className="smartmove-nav-link"
                  >
                    {link.label}
                  </Link>
                ))}
                {passenger || admin ? (
                  <button
                    onClick={logout}
                    className="smartmove-nav-link text-left"
                  >
                    Sign out
                  </button>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="smartmove-nav-link"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMenuOpen(false)}
                      className="smartmove-dark-button mt-2"
                    >
                      Get started{" "}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main
        id="main-content"
        className="smartmove-workspace-main smartmove-container"
      >
        {children}
      </main>
      <footer className="smartmove-footer">
        <div className="smartmove-container">
          <Link href="/" className="smartmove-brand">
            <span className="smartmove-brand-mark">
              <Route className="size-4" aria-hidden="true" />
            </span>
            <span>
              SmartMove<span className="brand-dot">.</span>
            </span>
          </Link>
          <span>Made for the journey.</span>
          <span className="smartmove-footer-note">
            Transport booking · Coursework project
          </span>
        </div>
      </footer>
    </div>
  )
}
