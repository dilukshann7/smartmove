db.feedback_content.find({ routeId: "1" });

db.feedback_content.find({}).sort({ vehicleRating: -1 });

db.feedback_content.aggregate([
  { $group: { _id: "$vehicleId", averageRating: { $avg: "$vehicleRating" } } },
]);

db.feedback_content.aggregate([
  { $group: { _id: "$driverId", averageRating: { $avg: "$driverRating" } } },
]);

db.feedback_content.find({ keywords: { $in: ["late", "delay"] } });

db.vehicle_assets.find({ vehicleId: "1" }); // Vehicle documents
db.trip_media.find({ vehicleId: "1", mediaType: "IMAGE" }, { data: 0 }); // Vehicle photos
db.trip_media.find({ tripId: "1" });

db.feedback_content.countDocuments();
db.notifications.find({ userId: "2", isRead: false });
