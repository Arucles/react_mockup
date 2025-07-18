require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool, Client } = require("pg");
const http = require("http");

const app = express();
app.use(cors());
app.use(express.json());

// Pool para consultas REST
const pool = new Pool();

app.get("/api/alarmas", async (req, res) => {
  const { region = "", comuna = "", tipo = "" } = req.query;
  try {
    // Construye filtros dinámicos
    const condiciones = [];
    const params = [];

    if (region) {
      params.push(region);
      condiciones.push(`region = $${params.length}`);
    }
    if (comuna) {
      params.push(comuna);
      condiciones.push(`comuna = $${params.length}`);
    }
    if (tipo) {
      params.push(tipo);
      condiciones.push(`tipo_dispositivo = $${params.length}`);
    }

    let sql = "SELECT * FROM alarmas";
    if (condiciones.length) sql += " WHERE " + condiciones.join(" AND ");
    sql += " ORDER BY nombre_dispositivo";

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error en /api/alarmas:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

// Levanta HTTP server y Socket.io
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

// Cliente dedicado para LISTEN/NOTIFY
const listener = new Client();
listener.connect().then(() => {
  listener
    .query("LISTEN status_channel")
    .then(() => console.log("👂 Listening on status_channel"))
    .catch(console.error);

  listener.on("notification", ({ channel, payload }) => {
    console.log(`🔔 Notification on ${channel}:`, payload);
    const evento = JSON.parse(payload);
    io.emit("db_change", evento);
  });
});

// Conexión de cliente WebSocket
io.on("connection", (socket) => {
  console.log("🔌 Cliente conectado:", socket.id);
  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`📡 Backend + WebSocket en http://localhost:${PORT}`)
);
