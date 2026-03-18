require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const app = express();
app.set("trust proxy", 1);
const { initFCM } = require("./fcm");
initFCM();

// #3 — Restrict CORS to specific domains only (no wildcard *)
const allowedOrigins = [
  "https://acadfee.onrender.com",
  "https://acadfee-app.onrender.com",
  "http://localhost:3000",
  "http://localhost:5000",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);

// #8 — Compression middleware — responses 70-80% smaller
app.use(compression());

app.use(express.json({ limit: "10mb" })); // increased for photo uploads

// #4 — Global rate limiter (generous — per-route tighter limits applied in auth.js)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(globalLimiter);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/branches", require("./routes/branches"));
app.use("/api/batches", require("./routes/batches"));
app.use("/api/students", require("./routes/students"));
app.use("/api/fees", require("./routes/fees"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/tests", require("./routes/tests"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/qrscan", require("./routes/qrscan"));
app.use("/api/admission", require("./routes/admission"));
app.use("/api/upload", require("./routes/upload"));

// #72 — Health check endpoint for UptimeRobot / monitoring
app.get("/health", (_, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  }),
);

app.get("/", (_, res) =>
  res.json({ status: "Nishchay Academy Fee API running" }),
);

// Global error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("CORS blocked")) {
    return res.status(403).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
