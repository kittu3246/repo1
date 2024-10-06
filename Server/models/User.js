const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number] // [longitude, latitude]
  },
  available: Boolean, // Marks user as available
});

// Create geospatial index on location
userSchema.index({ location: "2dsphere" });

const User = mongoose.model("User", userSchema);
module.exports = User;
