// FixIt realtime mini-service (socket.io).
// Runs on port 3003. Caddy forwards /?XTransformPort=3003 to this.
// Used for live booking/job status updates and notifications.

import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Channel = user id. Clients join their own channel after auth.
// For Phase 1 we trust the client-supplied userId (the API layer is the real
// auth boundary; realtime is a UX nicety).
io.on("connection", (socket) => {
  console.log(`[realtime] connected ${socket.id}`);

  socket.on("subscribe", (channel: string) => {
    if (typeof channel === "string" && channel.length > 0) {
      socket.join(channel);
      console.log(`[realtime] ${socket.id} subscribed ${channel}`);
    }
  });

  // Server-to-server emit (from API routes via fetch to a local HTTP hook).
  // We expose a tiny HTTP endpoint on the same port for the Next.js API to push
  // events without a socket.io client.
  socket.on("disconnect", () => {
    console.log(`[realtime] disconnected ${socket.id}`);
  });
});

// HTTP push endpoint for the Next.js API layer to emit events.
// POST /emit  { channel, event, payload }
httpServer.on("request", (req, res) => {
  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { channel, event, payload } = JSON.parse(body);
        io.to(channel).emit(event, payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end("bad request");
      }
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[fixit-realtime] socket.io listening on :${PORT}`);
});

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
