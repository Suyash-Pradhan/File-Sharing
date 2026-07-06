import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // send own id
  socket.emit("me", socket.id);

  // ✅ JOIN ROOM
  socket.on("user:joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(socket.id, "joined", roomId);

    // notify others
    socket.to(roomId).emit("user:joinedRoom", socket.id);
  });

  // ✅ OFFER
  socket.on("offer", ({ offer, to }) => {
    io.to(to).emit("offer", {
      offer,
      from: socket.id,
    });
  });

  // ✅ ANSWER
  socket.on("answer", ({ answer, to }) => {
    io.to(to).emit("answer", {
      answer,
      from: socket.id,
    });
  });

  // ✅ ICE
  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", {
      candidate,
      from: socket.id,
    });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user:leftRoom", socket.id);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});