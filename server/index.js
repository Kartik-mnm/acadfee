require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const compression  = require("compression");
const rateLimit    = require("express-rate-limit");
const app          = express();
app.set("trust proxy", 1);

const { initFCM }                = require("./fcm");
const { startAbsentCron, startKeepAlive, backfillStudentAcademyIds } = require("./cron");
const runMigration               = require("./migrate");

// Run DB migration, then backfill, then start services
runMigration().then(() => {
  backfillStudentAcademyIds(); // fix any students with null academy_id
});

initFCM();
startAbsentCron();
startKeepAlive(); // keep Render free tier awake

const allowedOrigins = [
  "https://acadfee.onrender.com",
  "https://acadfee-app.onrender.com",
  "https://expoent.netlify.app",
  "https://exponent-platform.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith(".onrender.com")) return callback(null, true);
    if (origin.endsWith(".netlify.app"))  return callback(null, true);
    if (origin.endsWith(".vercel.app"))   return callback(null, true);
    callback(new Error(`CORS blocked: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: "10mb" }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// Signup-specific rate limit — max 5 per IP per 15 min
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again in 15 minutes." },
});

// ── Routes ─────────────────────────────────────────────────────────────────────
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
app.use("/platform/auth",    require("./routes/platform-auth"));
app.use("/platform",         require("./routes/platform"));
app.use("/api/academy",      require("./routes/academy-config"));

// Signup route gets its own strict rate limiter
app.use("/api/onboarding", signupLimiter, require("./routes/onboarding"));

app.get("/health", (_, res) => res.json({
  status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime())
}));
app.get("/", (_, res) => res.json({ status: "Exponent Platform API running" }));

app.use((err, req, res, next) => {
  if (err.message?.startsWith("CORS blocked"))
    return res.status(403).json({ error: err.message });
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
