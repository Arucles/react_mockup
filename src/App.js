import React, { useState, useEffect } from "react";
import { Layout, Select, Card, Button, Row, Col, Table } from "antd";
import io from "socket.io-client";
import axios from "axios";
import "antd/dist/reset.css";
import "./App.css";

const { Header, Content } = Layout;
const { Option } = Select;

const kpisPorTipo = {
  BRAS: ["ping", "uplink", "errores"],
  OLT: ["ping", "interfaces_down", "errores"],
  HGU: ["ping", "usuarios_conectados", "pool_ips"],
};

function App() {
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [tipo, setTipo] = useState("BRAS");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1) Fetch inicial y por filtro
  useEffect(() => {
    console.log("🔄 [useEffect] Iniciando fetch con params:", {
      region,
      comuna,
      tipo,
    });
    setLoading(true);

    axios
      .get("http://localhost:4000/api/alarmas", {
        params: { region, comuna, tipo },
        timeout: 5000, // timeout a 5s
      })
      .then((res) => {
        console.log("✅ [axios.then] Código:", res.status);
        console.log("✅ [axios.then] Datos recibidos:", res.data);
        setData(res.data);
      })
      .catch((err) => {
        console.error(
          "❌ [axios.catch] Error al llamar /api/alarmas:",
          err.message
        );
        if (err.response) {
          console.error(
            "   response status:",
            err.response.status,
            err.response.data
          );
        }
      })
      .finally(() => {
        console.log(
          "🔚 [axios.finally] Antes de setLoading(false), loading era:",
          loading
        );
        setLoading(false);
        console.log(
          "🔚 [axios.finally] Después de setLoading(false), loading es:",
          false
        );
      });
  }, [region, comuna, tipo]);

  // 2) Socket.io para updates en caliente
  useEffect(() => {
    const socket = io("http://localhost:4000");
    socket.on("db_change", (evento) => {
      // solo actualizamos data, NO tocamos loading
      if (
        evento.tipo === tipo &&
        (region === "" || evento.region === region) &&
        (comuna === "" || evento.comuna === comuna)
      ) {
        setData((prev) => {
          const idx = prev.findIndex((r) => r.id === evento.id);
          const fila = {
            id: evento.id,
            nombre_dispositivo: evento.nombre,
            ping: evento.ping,
            uplink: evento.uplink,
            errores: evento.errores,
            usuarios_conectados: evento.usuarios,
            pool_ips: evento.pool,
            interfaces_down: evento.down,
          };
          let siguiente;
          if (idx >= 0) {
            // Reemplaza la fila existente
            siguiente = [...prev];
            siguiente[idx] = fila;
          } else {
            // Añade la nueva fila
            siguiente = [...prev, fila];
          }

          return siguiente;
        });
      }
    });
    return () => socket.disconnect();
  }, [region, comuna, tipo]);

  const metaFields = [
    "id",
    "tipo_dispositivo",
    "region",
    "comuna",
    "nombre_dispositivo",
    "timestamp",
  ];

  const kpiFields = React.useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter((key) => !metaFields.includes(key));
  }, [data]);

  // Columnas
  const columns = [
    {
      title: "Dispositivo",
      dataIndex: "nombre_dispositivo",
      key: "nombre_dispositivo",
    },
    // Ahora mapeamos **TODAS** las columnas de KPI que devolvió tu BD
    ...kpiFields.map((field) => ({
      title: field
        .split("_")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" "), // convierte "usuarios_conectados" → "Usuarios Conectados"
      dataIndex: field,
      key: field,
      align: "center",
      render: (val) => (
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: val === 1 ? "#28a745" : "#dc3545",
          }}
        />
      ),
    })),
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff" }}>
        <h2 style={{ textAlign: "center" }}>Panel de Monitoreo</h2>
      </Header>
      <Content style={{ padding: 24 }}>
        {/* Filtros */}
        <Row gutter={16} justify="center" style={{ marginBottom: 24 }}>
          <Col>
            <Select
              placeholder="Seleccione Región"
              style={{ width: 200 }}
              value={region}
              onChange={(v) => {
                setRegion(v);
                setComuna("");
              }}
            >
              <Option value="Valparaíso">Valparaíso</Option>
              <Option value="Metropolitana">Metropolitana</Option>
              <Option value="Biobío">Biobío</Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="Seleccione Comuna"
              style={{ width: 200 }}
              value={comuna}
              onChange={setComuna}
              disabled={!region}
            >
              {/* Aquí mapea las comunas según tu lógica */}
              {region === "Valparaíso" && (
                <>
                  <Option value="Viña del Mar">Viña del Mar</Option>
                  <Option value="Valparaíso">Valparaíso</Option>
                  <Option value="Quilpué">Quilpué</Option>
                </>
              )}
            </Select>
          </Col>
        </Row>

        {/* Botones para cambiar tipo de dispositivo */}
        <Row gutter={16} justify="center" style={{ marginBottom: 32 }}>
          {["BRAS", "OLT", "HGU"].map((d) => (
            <Col key={d}>
              <Card style={{ width: 140, textAlign: "center" }}>
                <Button
                  type={tipo === d ? "primary" : "default"}
                  onClick={() => setTipo(d)}
                  block
                >
                  {d}
                </Button>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Tabla de semáforos */}
        {/* tabla con spinner integrado */}
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Table
            dataSource={data}
            columns={columns}
            rowKey="id"
            pagination={false}
            bordered
            loading={loading}
          />
        </div>
      </Content>
      ;
    </Layout>
  );
}

export default App;
