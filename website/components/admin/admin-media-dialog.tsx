"use client"

import { apiFetch } from "@/lib/client-auth"

import Image from "next/image"
import { useEffect, useState, type FormEvent } from "react"
import { ImagePlus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MediaImage, MediaResource } from "@/lib/media-types"

export function AdminMediaDialog({
  target,
  onClose,
}: {
  target: { resource: MediaResource; id: number; label: string }
  onClose: () => void
}) {
  const [images, setImages] = useState<MediaImage[]>([])
  const [selection, setSelection] = useState<{
    file: File
    url: string
  } | null>(null)
  const [caption, setCaption] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch(`/api/admin/media?resource=${target.resource}&id=${target.id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load images.")
        setImages(data.result)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [target.resource, target.id])

  useEffect(
    () => () => {
      if (selection) URL.revokeObjectURL(selection.url)
    },
    [selection]
  )

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selection || busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const form = new FormData()
      form.set("resource", target.resource)
      form.set("id", String(target.id))
      form.set("image", selection.file)
      form.set("caption", caption)
      const response = await apiFetch("/api/admin/media", {
        method: "POST",
        body: form,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to upload image.")
      setImages((current) => [data.result, ...current])
      setSelection(null)
      setInputKey((current) => current + 1)
      setCaption("")
      setNotice("Image uploaded. It is now visible on the passenger trip page.")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to upload image."
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(image: MediaImage) {
    if (busy || !window.confirm("Remove this image from the website?")) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await apiFetch("/api/admin/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: target.resource,
          id: target.id,
          mediaId: image.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to remove image.")
      setImages((current) => current.filter((item) => item.id !== image.id))
      setNotice("Image removed.")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to remove image."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="size-5 text-[#236bcf]" />{" "}
            {target.resource === "vehicles" ? "Vehicle" : "Trip"} images
          </DialogTitle>
          <DialogDescription>
            {target.label} · Add photos for passengers to see when booking this{" "}
            {target.resource === "vehicles" ? "vehicle" : "trip"}.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-emerald-700"
          >
            {notice}
          </p>
        )}
        <form
          onSubmit={upload}
          className="space-y-4 rounded-2xl border border-[#e5ebf3] bg-[#f9fbfe] p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="media-image">Choose an image</Label>
            <Input
              key={inputKey}
              id="media-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy}
              className="h-auto min-h-11 bg-white py-2"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setError("")
                setNotice("")
                if (!file) {
                  setSelection(null)
                  return
                }
                if (
                  file.size > 5 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                ) {
                  setSelection(null)
                  setError("Choose a JPG, PNG or WebP image up to 5 MB.")
                  return
                }
                setSelection({ file, url: URL.createObjectURL(file) })
              }}
            />
            <p className="text-xs text-[#74859a]">
              JPG, PNG or WebP · Up to 5 MB per image. Photos are resized
              automatically.
            </p>
          </div>
          {selection && (
            <Image
              src={selection.url}
              alt="Selected image preview"
              width={640}
              height={360}
              unoptimized
              className="max-h-56 w-full rounded-xl bg-white object-contain"
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="media-caption">Caption (optional)</Label>
            <Input
              id="media-caption"
              value={caption}
              maxLength={160}
              disabled={busy}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="e.g. Air-conditioned passenger cabin"
              className="bg-white"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || loading || !selection}
            className="bg-[#236bcf] text-white"
          >
            <Upload className="size-4" /> {busy ? "Working…" : "Upload image"}
          </Button>
        </form>
        <section aria-label="Current images" className="space-y-3">
          <h3 className="font-semibold">
            Current images {images.length > 0 && `(${images.length})`}
          </h3>
          {loading ? (
            <p role="status" className="text-sm text-[#74859a]">
              Loading images…
            </p>
          ) : images.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#dfe7f1] p-5 text-center text-sm text-[#74859a]">
              No images yet. Upload your first photo above.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {images.map((image) => (
                <figure
                  key={image.id}
                  className="overflow-hidden rounded-2xl border border-[#e5ebf3] bg-white"
                >
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={image.caption || "Open full image"}
                  >
                    <Image
                      src={image.url}
                      alt={image.caption || `${target.label} photo`}
                      width={640}
                      height={360}
                      unoptimized
                      className="aspect-video w-full bg-[#f5f8fc] object-cover"
                    />
                  </a>
                  <figcaption className="flex items-start justify-between gap-3 p-3">
                    <p className="text-sm break-words text-[#60758f]">
                      {image.caption || "No caption"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(image)}
                      aria-label={`Remove ${image.caption || "image"}`}
                    >
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
