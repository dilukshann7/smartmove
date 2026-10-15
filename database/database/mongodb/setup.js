// Fictional coursework data. Existing records and read/reply states are preserved.
// Run with mongosh; website uploads store image bytes directly in trip_media.
db = db.getSiblingDB("smartmove");
const seededAt = new Date();

// Keep indexes aligned with website/lib/server/mongo.ts.
db.feedback_content.createIndex({ feedbackId: 1 }, { unique: true });
db.notifications.createIndex(
  { userId: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: "string" } } },
);
db.notifications.createIndex({ userId: 1, isRead: 1 });
db.announcements.createIndex({ audience: 1, status: 1, publishedAt: -1 });
db.vehicle_assets.createIndex({ vehicleId: 1, assetType: 1, createdAt: -1 });
db.trip_media.createIndex({ tripId: 1, mediaType: 1, createdAt: -1 });
db.trip_media.createIndex({ vehicleId: 1, mediaType: 1, createdAt: -1 });
db.trip_media.createIndex({ fileId: 1 }, { sparse: true });

// IDs reference the fictional Oracle 05_sample_data.sql records.
db.feedback_content.updateOne(
  { feedbackId: "1" },
  {
    $setOnInsert: {
      feedbackId: "1",
      bookingId: "1",
      type: "REVIEW",
      routeId: "1",
      vehicleId: "1",
      driverId: "1",
      vehicleRating: 4,
      driverRating: 5,
      comment:
        "The vehicle was clean and the driver was helpful, but arrival was late.",
      keywords: ["clean", "helpful", "late"],
      createdAt: seededAt,
      reply: {
        staffName: "Demo Staff",
        message: "Thank you for your feedback.",
        repliedAt: seededAt,
      },
    },
  },
  { upsert: true },
);

// Vehicle documents stay here. All vehicle/trip image records use trip_media.
db.vehicle_assets.updateOne(
  {
    vehicleId: "1",
    assetType: "DOCUMENT",
    fileUrl: "/uploads/demo-vehicle-record.pdf",
  },
  {
    $setOnInsert: {
      vehicleId: "1",
      assetType: "DOCUMENT",
      fileUrl: "/uploads/demo-vehicle-record.pdf",
      title: "Fictional demo vehicle record",
      isDemo: true,
      createdAt: seededAt,
    },
  },
  { upsert: true },
);

db.announcements.updateOne(
  { title: "Arrive early", audience: "PASSENGERS" },
  {
    $setOnInsert: {
      title: "Arrive early",
      body: "Sample coursework notice: please arrive 15 minutes before departure.",
      audience: "PASSENGERS",
      status: "PUBLISHED",
      createdAt: seededAt,
      updatedAt: seededAt,
      publishedAt: seededAt,
    },
  },
  { upsert: true },
);

db.notifications.updateOne(
  { userId: "1", eventKey: "booking:1:confirmed" },
  {
    $setOnInsert: {
      userId: "1",
      eventKey: "booking:1:confirmed",
      message: "Your booking 1 is confirmed.",
      isRead: false,
      href: "/bookings/1",
      createdAt: seededAt,
    },
  },
  { upsert: true },
);

// Portable demo images are served from website/public/uploads.
// Uploaded images instead add fileId (ObjectId), data (BinData), contentType
// (image/webp), width and height to the same document; no GridFS collections.
const demoImages = [
  {
    vehicleId: "1",
    uploadedBy: "1",
    mediaType: "IMAGE",
    fileUrl: "/uploads/demo-vehicle.png",
    caption: "Generated vehicle illustration for the coursework demo",
    isDemo: true,
    source: "GENERATED_DEMO",
    createdAt: seededAt,
  },
  {
    tripId: "1",
    uploadedBy: "1",
    mediaType: "IMAGE",
    fileUrl: "/uploads/demo-trip.png",
    caption: "Generated journey illustration for the coursework demo",
    isDemo: true,
    source: "GENERATED_DEMO",
    createdAt: seededAt,
  },
];
for (const image of demoImages) {
  const target = image.tripId
    ? { tripId: image.tripId }
    : { vehicleId: image.vehicleId };
  db.trip_media.updateOne(
    { ...target, mediaType: "IMAGE", fileUrl: image.fileUrl },
    { $setOnInsert: image },
    { upsert: true },
  );
}
print(
  "SmartMove setup complete: five collections with existing records preserved.",
);
