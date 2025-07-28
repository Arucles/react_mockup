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

// Endpoint para BRAS
app.get("/api/alarmas/bras", async (req, res) => {
  const { region = "", comuna = "" } = req.query;
  try {
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
    let sql = "SELECT * FROM alarmas_bras";
    if (condiciones.length) sql += " WHERE " + condiciones.join(" AND ");
    sql += " ORDER BY nombre_dispositivo";
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error en /api/alarmas/bras:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

// Endpoint para OLT
app.get("/api/alarmas/olt", async (req, res) => {
  const { region = "", comuna = "" } = req.query;
  try {
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
    let sql = "SELECT * FROM alarmas_olt";
    if (condiciones.length) sql += " WHERE " + condiciones.join(" AND ");
    sql += " ORDER BY nombre_dispositivo";
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error en /api/alarmas/olt:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

// Endpoint para HGU
app.get("/api/alarmas/hgu", async (req, res) => {
  const { region = "", comuna = "" } = req.query;
  try {
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
    let sql = "SELECT * FROM alarmas_hgu";
    if (condiciones.length) sql += " WHERE " + condiciones.join(" AND ");
    sql += " ORDER BY nombre_dispositivo";
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error en /api/alarmas/hgu:", err);
    return res.status(500).json({ error: "Error interno en el servidor" });
  }
});

// Endpoint para RADIUS
app.get("/api/alarmas/radius", async (req, res) => {
  const { region = "", comuna = "" } = req.query;
  try {
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
    let sql = "SELECT * FROM alarmas_radius";
    if (condiciones.length) sql += " WHERE " + condiciones.join(" AND ");
    sql += " ORDER BY nombre_dispositivo";
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error en /api/alarmas/radius:", err);
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
