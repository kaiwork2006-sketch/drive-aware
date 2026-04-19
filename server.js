const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("."));

const liveUsers = new Map();

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function cleanupOldUsers() {
  const now = Date.now();
  const maxAgeMs = 15000;

  for (const [userId, user] of liveUsers.entries()) {
    if (now - user.updatedAt > maxAgeMs) {
      liveUsers.delete(userId);
    }
  }
}

app.post("/api/update-location", (req, res) => {
  const { userId, lat, lng, speed } = req.body;

  if (
    !userId ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  ) {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }

  liveUsers.set(userId, {
    userId,
    lat,
    lng,
    speed: typeof speed === "number" ? speed : 0,
    updatedAt: Date.now()
  });

  cleanupOldUsers();

  res.json({ ok: true });
});

app.get("/api/nearby", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const userId = req.query.userId;

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    !userId
  ) {
    return res.status(400).json({ error: "Missing query params" });
  }

  cleanupOldUsers();

  const nearby = [];

  for (const [otherUserId, user] of liveUsers.entries()) {
    if (otherUserId === userId) continue;

    const distanceKm = getDistanceKm(lat, lng, user.lat, user.lng);

    if (distanceKm <= 2) {
      nearby.push({
        userId: user.userId,
        lat: user.lat,
        lng: user.lng,
        speed: user.speed,
        distanceKm: Number(distanceKm.toFixed(2))
      });
    }
  }

  res.json({
    nearbyCount: nearby.length,
    users: nearby
  });
});

app.listen(PORT, () => {
  console.log(`DriveAware server running on port ${PORT}`);
});
