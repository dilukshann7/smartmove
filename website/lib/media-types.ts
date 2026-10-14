export type MediaResource = "vehicles" | "trips"

export type MediaImage = {
  id: string
  url: string
  caption: string
}

export type TripImages = {
  trip: MediaImage[]
  vehicle: MediaImage[]
}
