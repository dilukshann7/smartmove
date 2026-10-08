# SmartMove demo media

These files are fictional demonstration content for the coursework. Both pictures were created with the built-in image-generation tool; they are illustrative images rather than photos documenting the seeded trips or a real operator.

| URL                                | Content                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/uploads/demo-vehicle.png`        | Generic white passenger minibus in a sunny Sri Lankan depot                                                |
| `/uploads/demo-trip.png`           | Generic white passenger minibus on a southern coastal road toward Galle                                    |
| `/uploads/demo-vehicle-record.pdf` | One-page vehicle document using the fictional Oracle record for vehicle 1, DEMO-001, VAN, 12 seats, ACTIVE |

MongoDB stores the file URLs in `vehicle_assets` and `trip_media`. Next.js serves these files from `public/`. Media upload or editing screens have not been added.

## Image prompts

Vehicle: clean editorial landscape photograph of a generic white 12-seat passenger minibus, parked in a sunny Sri Lankan depot with palm trees and low buildings, whole vehicle visible in a three-quarter front view, natural morning light, no logos or readable plates, no text or watermark.

Trip: landscape editorial photograph of a Sri Lankan southern coastal road with coconut palms and ocean, a generic small white passenger minibus driving away in the left lane toward Galle, natural late-afternoon light, no readable plates or signs, no text, logos or watermark.
