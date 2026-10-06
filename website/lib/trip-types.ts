export type Trip = {
  id: number
  routeName: string
  origin: string
  destination: string
  departureAt: string
  arrivalAt: string
  fare: number
  vehicleType: string
  registrationNumber: string
  seatCount: number
  availableSeats: number
}

export type TripRow = {
  TRIP_ID: number
  ROUTE_NAME: string
  ORIGIN: string
  DESTINATION: string
  DEPARTURE_AT: string
  ARRIVAL_AT: string
  FARE: number
  VEHICLE_TYPE: string
  REGISTRATION_NUMBER: string
  SEAT_COUNT: number
  AVAILABLE_SEATS: number
}

export function mapTrip(row: TripRow): Trip {
  return {
    id: row.TRIP_ID,
    routeName: row.ROUTE_NAME,
    origin: row.ORIGIN,
    destination: row.DESTINATION,
    departureAt: row.DEPARTURE_AT,
    arrivalAt: row.ARRIVAL_AT,
    fare: row.FARE,
    vehicleType: row.VEHICLE_TYPE,
    registrationNumber: row.REGISTRATION_NUMBER,
    seatCount: row.SEAT_COUNT,
    availableSeats: row.AVAILABLE_SEATS,
  }
}

export type TripDetails = Trip & { occupiedSeats: number[] }

export type Booking = {
  id: number
  tripId: number
  origin: string
  destination: string
  departureAt: string
  arrivalAt: string
  vehicleType: string
  status: "PENDING" | "CONFIRMED" | "CANCELLED"
  expiresAt: string
  seats: { id: number; number: number; fare: number; status: string }[]
  totalFare: number
  canCancel: boolean
  refundStatus: "NONE" | "PENDING" | "RECORDED"
  refundAmount: number | null
}
