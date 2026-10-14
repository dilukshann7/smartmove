"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { TripImages } from "@/lib/media-types"

export function TripImageGallery({
  tripId,
  label,
}: {
  tripId: number
  label: string
}) {
  const [images, setImages] = useState<TripImages | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/trips/${tripId}/media`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load photos")
        setImages((await response.json()).images)
      })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable(true)
      })
    return () => controller.abort()
  }, [tripId])
  if (unavailable)
    return (
      <p className="text-sm text-[#74859a]">
        Trip photos are temporarily unavailable.
      </p>
    )
  if (!images || (!images.trip.length && !images.vehicle.length)) return null
  return (
    <Card className="rounded-[26px] border-[#e5ebf3] bg-white py-0 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold">
          <ImageIcon className="size-5 text-[#3278d2]" /> Trip and vehicle
          photos
        </h2>
        {[
          { label: "Trip photos", images: images.trip },
          { label: "Vehicle photos", images: images.vehicle },
        ]
          .filter((group) => group.images.length > 0)
          .map((group) => (
            <section key={group.label} className="space-y-3">
              <h3 className="text-sm font-medium text-[#60758f]">
                {group.label}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.images.map((image) => (
                  <figure
                    key={image.id}
                    className="overflow-hidden rounded-2xl border border-[#edf1f6]"
                  >
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={
                        image.caption || `Open ${group.label.toLowerCase()}`
                      }
                    >
                      <Image
                        src={image.url}
                        alt={
                          image.caption ||
                          `${label} ${group.label.toLowerCase()}`
                        }
                        width={960}
                        height={540}
                        unoptimized
                        className="aspect-video w-full bg-[#f5f8fc] object-cover"
                      />
                    </a>
                    {image.caption && (
                      <figcaption className="p-3 text-sm break-words text-[#60758f]">
                        {image.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          ))}
      </CardContent>
    </Card>
  )
}
