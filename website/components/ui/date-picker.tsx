"use client"

import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { sriLankaDate } from "@/lib/admin-reports"

export function DatePicker({
  id,
  value,
  onChange,
  minDate,
  required = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  minDate?: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(`${value}T12:00:00+05:30`) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        render={<Button variant="outline" />}
        aria-required={required}
        className="mt-2 h-11 w-full justify-start gap-2 rounded-xl text-left font-normal"
      >
        <CalendarDays className="size-4 text-[#236bcf]" aria-hidden="true" />
        {selected
          ? new Intl.DateTimeFormat("en-LK", {
              timeZone: "Asia/Colombo",
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(selected)
          : "Choose a date"}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-2xl bg-white p-0 [--background:#fff] [--foreground:#1d1d1f] [--muted-foreground:#6b7f9c] [--muted:#eff6ff] [--primary-foreground:#fff] [--primary:#236bcf]"
      >
        <Calendar
          mode="single"
          required
          autoFocus
          timeZone="Asia/Colombo"
          selected={selected}
          defaultMonth={selected}
          disabled={
            minDate ? (date) => sriLankaDate(date) < minDate : undefined
          }
          onSelect={(date) => {
            onChange(sriLankaDate(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
