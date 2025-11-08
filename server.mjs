// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import mysql from "mysql2";
import axios from "axios";
import { Server } from "socket.io";

import AuthRoutes from "./AuthRoutes.js";
import MessageRoutes from "./MessageRoutes.js";

dotenv.config();
const app = express();

// ───── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


// serve uploaded recordings and images
app.use("/uploads/recordings", express.static("uploads/recordings"));
app.use("/uploads/images",    express.static("uploads/images"));

// ───── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth",     AuthRoutes);
app.use("/api/messages", MessageRoutes);



// ───── MySQL Connection ───────────────────────────────────────────────────────
const db = mysql.createConnection({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
   password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
 
  ssl: {
    ca: `-----BEGIN CERTIFICATE-----
MIIEQTCCAqmgAwIBAgIUdOBuOfcuyU5AJP5JwiSW4e+gdocwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvMWIxZTU2YTEtYjg5NS00NWNjLWEyOTEtNTQxNTZlMTg0
OWM5IFByb2plY3QgQ0EwHhcNMjQwODA3MTYzNDMxWhcNMzQwODA1MTYzNDMxWjA6
MTgwNgYDVQQDDC8xYjFlNTZhMS1iODk1LTQ1Y2MtYTI5MS01NDE1NmUxODQ5Yzkg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAPrD2IVF
ruxHy4VETVWUix4wiGcHG6zk/APwfwUqbgthOylKCobWuLmm6m+aP57S9LIQmiWT
34imu5dsh4AMSNdgeHmhdyu2GgOr6kEqbZEF+jiA4Olp0OeyDDbEAyW1yF6/qE26
L5VVp3AATAg0JK2N7q0sW2A5KviYxKS83u0ybdQSrYl42tGfwjCjl/pnY9l4qK3j
4qfIbB5nctLISMfRQ0/2VSVyBtmLcKHSHVZw+3Tg8chdAeV60zSaUfYDIMadXWSq
SWcxr92qqQ2kUBvElrZM19LCWGk4VkRTlfb/a/BAIQSBK21Wjgn7iT4zE2oVq4pF
qnglQkAA8x8Md9zPENhv9KXiRS5NUSPmCAtaj4tPfYqHmI8IzmAnh7cb2pZnndcV
oiHirQ0gcZMVq+exEovdBZa57qbSfft1UsIqa4JitUHmrMja4WRLo+FfreEkqOYa
EQr4pHpIPC/YPpsyzX1KSh2DvRPJTipBchlDP9Fj2ZGDIsW/bVHx6NzocQIDAQAB
oz8wPTAdBgNVHQ4EFgQU8yzjPQgvkyOLTtjAjWadt9pWBt4wDwYDVR0TBAgwBgEB
/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAFD9h6Nb8QSyEjy0
R8lwfUyC6cubdXulp6i28OP0xyK5WdSn/e/c2iEhE3qBgt/g0QUjx5rla7M5J+d2
7Hj09MuMFtN3pc4E9Y3qEF/zWhdrO/4KyWB3rqqvLZ85CLtB4i6U0RTBbHF9pqVg
WwMtaVkYj+WC/HFrSpauS9uXhJQt901EUFB8mNC4ixCoKk6GW0h0uKvtzqs6P1UI
MENB61vsc8zNqNXEZxxcpX8VfkiPYU9ZAxWrhfcihkpbyCj75zKcFmVgHtI7b2wU
8YJD2IZUAQW0CmKNstrHA4kzIYUlaTrRuOZzK2u5F7WL01R9TSNu+sJA7WNOyh3m
QEjbu0Vwi4XBUs2YQywHXLdluiHtitNMjoqnoQJXQnSpUPtX6IcYTBG2PIw7haAA
WGjgha0WB92BuYI3zYZk6sFNEYG25e1QlqrAiTFDs/w+MuxOh5+EWEIZKW11MU1J
mdbUG/brd0pa05k498y4wXkzmr2AvldznE7MZEe+Ll0Kw5K16g==
-----END CERTIFICATE-----
`,
    rejectUnauthorized: true
  }
});db.connect(err => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL");
});

// make db available in your routes via req.app.locals
app.locals.db = db;

// ───── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});



// ───── Start HTTP & Socket.IO Servers ────────────────────────────────────────
const PORT = process.env.PORT || 3005;
const server = app.listen(PORT, () => {
  console.log(`server started on port ${PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this in production
    methods: ["GET", "POST"]
  }
});


// Make io available in your routes:
app.locals.io = io;


// track online users

global.onlineUsers = new Map();
io.on("connection", (socket) => {
  global.chatSocket = socket;
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.broadcast.emit("online-users", {
      onlineUsers: Array.from(onlineUsers.keys()),
    });
  });
  
  
  



  socket.on("signout", (id) => {
    onlineUsers.delete(id);
    socket.broadcast.emit("online-users", {
      onlineUsers: Array.from(onlineUsers.keys()),
    });
  });
  

  socket.on("outgoing-voice-call", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("incoming-voice-call", {
        from: data.from,
        roomId: data.roomId,
        callType: data.callType,
      });
    } else {
      const senderSocket = onlineUsers.get(data.from);
      socket.to(senderSocket).emit("voice-call-offline");
    }
  });

  socket.on("reject-voice-call", (data) => {
    const sendUserSocket = onlineUsers.get(data.from);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("voice-call-rejected");
    }
  });

  socket.on("outgoing-video-call", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("incoming-video-call", {
        from: data.from,
        roomId: data.roomId,
        callType: data.callType,
      });
    } else {
      const senderSocket = onlineUsers.get(data.from);
      socket.to(senderSocket).emit("video-call-offline");
    }
  });

  socket.on("accept-incoming-call", ({ id }) => {
    const sendUserSocket = onlineUsers.get(id);
    socket.to(sendUserSocket).emit("accept-call");
  });

  socket.on("reject-video-call", (data) => {
    const sendUserSocket = onlineUsers.get(data.from);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("video-call-rejected");
    }
  });

  socket.on("send-msg", (data) => {
    const sendUserSocket = onlineUsers.get(data.to);
    if (sendUserSocket) {
      socket
        .to(sendUserSocket)
        .emit("msg-recieve", { from: data.from, message: data.message });
    }
  });
  console.log(socket.listenerCount("add-user")); // will show number of add-user listeners


  socket.on("mark-read", ({ id, recieverId }) => {
    const sendUserSocket = onlineUsers.get(id);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("mark-read-recieve", { id, recieverId });
    }
  });
});