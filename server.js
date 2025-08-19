// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ===== Seguridad básica =====
app.use(helmet({ crossOriginResourcePolicy: false }));

// ===== Parsers =====
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===== CORS (Render + cookies cross-site) =====
// Soporta: CORS_ORIGIN="https://tu-fe.com,https://otro.com" o FRONTEND_URL="https://tu-fe.com"
const rawOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// En dev permitimos herramientas sin origin (curl/Postman). En prod, lista blanca.
const allowAll = (!rawOrigins.length && process.env.NODE_ENV !== 'production') || rawOrigins.includes('*');

const normalize = (url) => (url || '').replace(/\/+$/, ''); // quita trailing slash

app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sin origin (curl/Postman/healthchecks)
    if (!origin) return cb(null, true);

    if (allowAll) return cb(null, true);

    const ok = rawOrigins.some(o => normalize(o) === normalize(origin));
    return ok ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true, // necesario para cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ===== Proxy (Render) =====
// Necesario para que Set-Cookie con Secure/SameSite funcione detrás del proxy
app.set('trust proxy', 1);

// ===== Healthchecks =====
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// ✅ Ruta raíz para verificar estado del backend
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✅ Backend SIGEP-GC activo y funcionando en Render 🚀',
  });
});

// ===== Rutas principales (tus rutas) =====
const authRoutes = require('./routes/auth');
const pedidoRoutes = require('./routes/pedidos');
app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidoRoutes);

// ===== 404 por defecto =====
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Not Found' });
});

// ===== Manejo de errores =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ success: false, message: 'Server error' });
});

// ===== Puerto de escucha (Render inyecta PORT) =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
