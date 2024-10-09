// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

let users = []; // Store registered users and their locations

// Utility function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// REST API endpoint to register a user
app.post('/register', (req, res) => {
  const { username, latitude, longitude } = req.body;

  if (!username || !latitude || !longitude) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  console.log(`User registered: ${username}, Lat: ${latitude}, Lon: ${longitude}`);
  res.status(200).json({ message: 'User registered successfully' });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Register user with location
  socket.on('registerUser', (userData) => {
    const { username, latitude, longitude } = userData;
    console.log(`User registered with WebSocket: ${username}`);

    // Store user in the in-memory users array
    users.push({
      id: socket.id,
      username,
      latitude,
      longitude
    });
  });

  // Handle sending a message/request
  socket.on('sendMessage', (data) => {
    const { message, latitude, longitude } = data;
    console.log(`Message from ${latitude}, ${longitude}: ${message}`);

    // Find the nearest user
    let nearestUser = null;
    let minDistance = Infinity;

    users.forEach(user => {
      const distance = calculateDistance(latitude, longitude, user.latitude, user.longitude);
      if (distance < minDistance) {
        nearestUser = user;
        minDistance = distance;
      }
    });

    if (nearestUser) {
      // Send message to the nearest user
      io.to(nearestUser.id).emit('receiveRequest', {
        message,
        senderLocation: { latitude, longitude }
      });
      console.log(`Message sent to nearest user: ${nearestUser.username}`);
    } else {
      console.log('No users found nearby.');
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    users = users.filter(user => user.id !== socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
