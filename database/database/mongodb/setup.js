db.feedback_content.insertOne({
  feedbackId: "1",
  routeId: "1",
  vehicleId: "1",
  driverId: "1",
  vehicleRating: 4,
  driverRating: 5,
  comment:
    "The vehicle was clean and the driver was helpful, but arrival was late.",
  keywords: ["clean", "helpful", "late"],
  reply: {
    staffName: "Demo Staff",
    message: "Thank you for your feedback.",
  },
});

db.trip_media.insertOne({
  vehicleId: "1",
  mediaType: "IMAGE",
  fileUrl: "/uploads/demo-vehicle.png",
});

db.vehicle_assets.insertOne({
  vehicleId: "1",
  assetType: "DOCUMENT",
  fileUrl: "/uploads/demo-vehicle-record.pdf",
});

db.announcements.insertOne({
  title: "Arrive early",
  body: "Please arrive 15 minutes before departure.",
  audience: "PASSENGERS",
});

db.notifications.insertOne({
  userId: "2",
  message: "Your booking 2 is confirmed.",
  isRead: false,
});

db.trip_media.insertOne({
  tripId: "1",
  uploadedBy: "1",
  mediaType: "IMAGE",
  fileUrl: "/uploads/demo-trip.png",
  caption: "Generated journey illustration for the coursework demo",
});

// These demo files are included in website/public/uploads.
