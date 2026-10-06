export type PortalBooking = {
  id: number
  tripId: number
  origin: string
  destination: string
  departureAt: string
  arrivalAt: string
  tripStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED"
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  seatCount: number
  totalFare: number
  canCancel: boolean
  refundStatus: "NONE" | "PENDING" | "RECORDED"
  refundAmount: number | null
}

export type PortalTicket = {
  id: number
  bookingId: number
  seatNumber: number
  fare: number
  origin: string
  destination: string
  departureAt: string
  arrivalAt: string
  vehicleType: string
  registrationNumber: string
}

export type PortalFeedback = {
  id: number
  bookingId: number
  type: "REVIEW" | "COMPLAINT"
  status: "OPEN" | "RESOLVED"
  route: string
  comment: string | null
  subject: string | null
  vehicleRating: number | null
  driverRating: number | null
  reply: { staffName: string; message: string } | null
}
