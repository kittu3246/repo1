const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from this origin
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    },
});

app.use(cors());
app.use(bodyParser.json());

let users = []; // Array to hold registered users

// Registration Endpoint
app.post('/register', (req, res) => {
    const { username, latitude, longitude } = req.body;
    if (!username || !latitude || !longitude) {
        return res.status(400).send('All fields are required.');
    }

    // Check if the user already exists
    const userExists = users.find(user => user.username === username);
    if (userExists) {
        return res.status(400).send('User already registered.');
    }

    console.log(`User registered: ${username}, Latitude: ${latitude}, Longitude: ${longitude}`);
    users.push({ username, latitude: parseFloat(latitude), longitude: parseFloat(longitude), socketId: null });
    res.status(201).send('Registration successful');
});

// Send Request Endpoint
app.post('/sendRequest', (req, res) => {
    const { message, latitude, longitude } = req.body;

    if (!message || !latitude || !longitude) {
        return res.status(400).send('Message, latitude, and longitude are required.');
    }

    const senderLatitude = parseFloat(latitude);
    const senderLongitude = parseFloat(longitude);
    const nearestUser = findNearestUser(senderLatitude, senderLongitude);

    if (nearestUser) {
        console.log(`Sending message to nearest user ${nearestUser.username}: ${message}`);
        // Emit the message to the nearest user
        io.to(nearestUser.socketId).emit("messageSent", { user: nearestUser.username, message });
        res.status(200).send('Request sent successfully.');
    } else {
        res.status(404).send('No users available to send the message.');
    }
});

// Function to calculate distance using the Haversine formula
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Function to find the nearest user
function findNearestUser(senderLatitude, senderLongitude) {
    let nearestUser = null;
    let minDistance = Infinity;

    users.forEach(user => {
        const distance = haversineDistance(senderLatitude, senderLongitude, user.latitude, user.longitude);
        // Ensure the user is connected (has a socketId)
        if (distance < minDistance && user.socketId) {
            minDistance = distance;
            nearestUser = user;
        }
    });

    return nearestUser;
}

// Socket connection handling
io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("registerUser", (username) => {
        const userIndex = users.findIndex(user => user.username === username);
        if (userIndex !== -1) {
            users[userIndex].socketId = socket.id; // Assign socket ID to user
            console.log(`Socket ID ${socket.id} registered for user ${username}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
        // Remove the socket ID from the user when they disconnect
        users.forEach(user => {
            if (user.socketId === socket.id) {
                user.socketId = null; // Clear the socket ID on disconnect
                console.log(`User ${user.username} disconnected`);
            }
        });
    });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "client/build")));

// Catch-all handler to serve React app
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname + "/client/build/index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
