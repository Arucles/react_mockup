import React, { useState, useEffect } from "react";
import {
  Layout,
  Select,
  Card,
  Button,
  Row,
  Col,
  Table,
  Modal,
  Tooltip,
  Switch,
} from "antd";
import io from "socket.io-client";
import axios from "axios";
import "antd/dist/reset.css";
import "./App.css";

const { Header, Content } = Layout;
const { Option } = Select;

const kpisPorTipo = {
  BRAS: ["ping", "uplink", "errores", "pool_ips", "usuarios_conectados"],
  OLT: ["ping", "interfaces_down", "errores"],
  HGU: ["ping", "usuarios_conectados", "pool_ips"],
  RADIUS: ["uptime", "usuarios_on", "por_definir"],
};

function App() {
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [tipo, setTipo] = useState("BRAS");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // 1) Fetch inicial y por filtro
  useEffect(() => {
    console.log("🔄 [useEffect] Iniciando fetch con params:", {
      region,
      comuna,
      tipo,
    });
    setLoading(true);

    // Mapear tipo a endpoint
    const endpointMap = {
      BRAS: "/api/alarmas/bras",
      OLT: "/api/alarmas/olt",
      HGU: "/api/alarmas/hgu",
      RADIUS: "/api/alarmas/radius",
    };
    const endpoint = endpointMap[tipo] || "/api/alarmas/bras";

    axios
      .get(`http://localhost:4000${endpoint}`, {
        params: { region, comuna },
        timeout: 5000, // timeout a 5s
      })
      .then((res) => {
        console.log("✅ [axios.then] Código:", res.status);
        console.log("✅ [axios.then] Datos recibidos:", res.data);
        setData(res.data);
      })
      .catch((err) => {
        console.error(
          `❌ [axios.catch] Error al llamar ${endpoint}:`,
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
        setLoading(false);
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
    if (data.length === 0) return kpisPorTipo[tipo] || [];
    // Si hay datos, usa las llaves de los datos menos los metadatos
    return Object.keys(data[0]).filter((key) => !metaFields.includes(key));
  }, [data, tipo]);

  // Descripciones para tooltips simples
  const kpiDescriptions = {
    ping: "Latencia de respuesta de red",
    uplink: "Estado del enlace de subida",
    errores: "Cantidad de errores detectados",
    usuarios_conectados: "Usuarios conectados actualmente",
    pool_ips: "Disponibilidad de direcciones IP",
    interfaces_down: "Interfaces caídas",
    uptime: "Tiempo en línea del servidor RADIUS",
    usuarios_on: "Cantidad de usuarios conectados al RADIUS",
    por_definir: "KPI pendiente de definición",
  };

  function obtenerDetalleProblema(field, record) {
    // Aquí puedes personalizar el mensaje según el KPI y el registro
    // Ejemplo simple:
    if (field === "uplink") return "Problema en Uplink: enlace caído";
    if (field === "ping") return "Problema de latencia: respuesta alta";
    if (field === "errores") return "Errores detectados en el dispositivo";
    // O puedes usar un campo de detalle si existe: record.detalle_errores, etc.
    return "Problema en KPI";
  }

  // Columnas
  const columns = [
    {
      title: "Dispositivo",
      dataIndex: "nombre_dispositivo",
      key: "nombre_dispositivo",
    },
    // Ahora mapeamos **TODAS** las columnas de KPI que devolvió tu BD
    ...kpiFields.map((field) => ({
      title: (
        <Tooltip
          title={kpiDescriptions[field] || ""}
          color="#1890ff"
          placement="top"
        >
          <span>
            {field
              .split("_")
              .map((w) => w[0].toUpperCase() + w.slice(1))
              .join(" ")}
          </span>
        </Tooltip>
      ),
      dataIndex: field,
      key: field,
      align: "center",
      render: (val, record) =>
        val === 1 ? (
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#28a745",
            }}
          />
        ) : (
          <Tooltip
            title={obtenerDetalleProblema(field, record)}
            color="#f5222d"
            placement="top"
          >
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#dc3545",
                cursor: "pointer",
              }}
            />
          </Tooltip>
        ),
    })),
  ];

  // Render detalle (card fija o modal)
  const renderDetail = (item) => {
    if (!item) return null;
    return (
      <Card
        title={item.nombre_dispositivo}
        style={{ marginLeft: 24, minWidth: 250 }}
      >
        <b>Detalle:</b>
        <ul>
          {Object.entries(item)
            .filter(
              ([key]) =>
                ![
                  "id",
                  "tipo_dispositivo",
                  "region",
                  "comuna",
                  "timestamp",
                ].includes(key)
            )
            .map(([key, value]) => (
              <li key={key}>
                <b>
                  {key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                  :
                </b>{" "}
                {String(value)}
              </li>
            ))}
        </ul>
      </Card>
    );
  };

  return (
    <Layout
      className={darkMode ? "dark-mode" : ""}
      style={{ minHeight: "100vh" }}
    >
      <Header
        style={{
          background: darkMode ? "#23272f" : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: darkMode ? "#fff" : undefined,
            flex: 1,
            margin: 0,
          }}
        >
          Panel de Monitoreo
        </h2>
        <div className="header-switch-container">
          <span
            style={{ color: darkMode ? "#fff" : undefined, marginRight: 8 }}
          >
            🌙
          </span>
          <Switch checked={darkMode} onChange={setDarkMode} />
        </div>
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
          {["BRAS", "OLT", "HGU", "RADIUS"].map((d) => (
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
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex" }}>
          <div style={{ flex: 1 }}>
            <Table
              dataSource={data}
              columns={columns}
              rowKey="id"
              pagination={false}
              bordered
              loading={loading}
              onRow={(record) => ({
                onClick: () => {
                  setSelectedItem(record);
                  setModalVisible(true); // Para mostrar el modal
                },
                style: {
                  cursor: "pointer",
                  background:
                    selectedItem && selectedItem.id === record.id
                      ? "#e6f7ff"
                      : undefined,
                },
              })}
            />
          </div>
          {/* Card fija a la derecha (opción 1) */}
          <div style={{ minWidth: 270 }}>{renderDetail(selectedItem)}</div>
        </div>
        {/* Modal de detalle (opción 2) */}
        <Modal
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          title={selectedItem ? selectedItem.nombre_dispositivo : ""}
        >
          {renderDetail(selectedItem)}
        </Modal>
      </Content>
    </Layout>
  );
}

export default App;
