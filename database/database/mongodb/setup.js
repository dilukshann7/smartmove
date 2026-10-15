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
