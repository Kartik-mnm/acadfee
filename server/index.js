require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const compression  = require("compression");
const rateLimit    = require("express-rate-limit");
const app          = express();
app.set("trust proxy", 1);

const { initFCM }                         = require("./fcm");
const { startAbsentCron, startKeepAlive } = require("./cron");
const runMigration                        = require("./migrate");
const { checkConnection, startDbHeartbeat } = require("./db");

const allowedOrigins = [
  "https://acadfee.onrender.com",
  "https://acadfee-app.onrender.com",
  "https://exponentgrow.in",
  "https://www.exponentgrow.in",
  "https://app.exponentgrow.in",
  "https://api.exponentgrow.in",
  "https://exponent-platform.vercel.app",
  "https://expoent.netlify.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith(".exponentgrow.in")) return callback(null, true);
    console.warn(`[CORS] Blocked: ${origin}`);
    callback(new Error(`CORS blocked: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: "10mb" }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// ── Academy routes ────────────────────────────────────────────────────────────
app.use("/api/auth",         require("./routes/auth"));
app.use("/api/branches",     require("./routes/branches"));
app.use("/api/batches",      require("./routes/batches"));
app.use("/api/students",     require("./routes/students"));
app.use("/api/fees",         require("./routes/fees"));
app.use("/api/payments",     require("./routes/payments"));
app.use("/api/reports",      require("./routes/reports"));
app.use("/api/attendance",   require("./routes/attendance"));
app.use("/api/tests",        require("./routes/tests"));
app.use("/api/expenses",     require("./routes/expenses"));
app.use("/api/qrscan",       require("./routes/qrscan"));
app.use("/api/admission",    require("./routes/admission"));
app.use("/api/upload",       require("./routes/upload"));
app.use("/api/working-days", require("./routes/working-days"));
app.use("/api/daily-report", require("./routes/daily-report").router);
app.use("/api/whatsapp",     require("./routes/whatsapp"));
app.use("/api/fcm-debug",    require("./routes/fcm-debug"));

// ── Platform routes ────────────────────────────────────────────────────────────
app.use("/platform/auth",    require("./routes/platform-auth"));
app.use("/platform",         require("./routes/platform"));
app.use("/api/academy",      require("./routes/academy-config"));
app.use("/api/onboarding",   require("./routes/onboarding"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", async (_, res) => {
  try {
    const { query } = require("./db");
    await query("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  } catch (e) {
    res.status(503).json({ status: "error", db: "disconnected", error: e.message });
  }
});
app.get("/", (_, res) => res.json({ status: "Exponent Platform API running" }));

app.use((err, req, res, next) => {
  if (err.message?.startsWith("CORS blocked")) return res.status(403).json({ error: err.message });
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start server ──────────────────────────────────────────────────────────────
async function start() {
  const PORT = process.env.PORT || 5000;

  // 1. Verify DB is reachable before accepting traffic
  const dbOk = await checkConnection();
  if (!dbOk) {
    console.error("[startup] Database unavailable — starting anyway but requests may fail");
  }

  // 2. Run migrations (isolated — won't crash server)
  await runMigration();

  // 3. Start DB heartbeat — keeps connections alive, prevents cold-start 500s
  startDbHeartbeat();

  // 4. Init services
  initFCM();
  startAbsentCron();
  startKeepAlive();
  
  // 4b. Boot WhatsApp sessions asynchronously
  const { bootSavedSessions } = require("./whatsapp");
  bootSavedSessions();

  // 5. Start listening
  app.listen(PORT, () => {
    console.log(`\u2705 Server running on port ${PORT}`);
    console.log(`[startup] DB: ${dbOk ? "\u2705 connected" : "\u26a0 uncertain"}`);
  });
}

start().catch(err => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
