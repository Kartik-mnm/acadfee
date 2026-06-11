const router = require("express").Router();
const db     = require("../db");
const { authenticatePlatformOwner } = require("../middleware");
const admin  = require("firebase-admin");
const { sessions } = require("../whatsapp");

router.get("/", authenticatePlatformOwner, async (req, res) => {
  try {
    // 1. Database latency check
    const dbStart = Date.now();
    await db.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;

    // 2. Database pool stats
    const dbPoolTotal = db.pool.totalCount;
    const dbPoolIdle = db.pool.idleCount;
    const dbPoolWaiting = db.pool.waitingCount;

    // 3. FCM Status
    const fcmInitialized = admin.apps && admin.apps.length > 0;

    // 4. Resend status
    const resendConfigured = !!process.env.RESEND_API_KEY;

    // 5. WhatsApp Statuses
    const whatsappSessions = [];
    for (const [academyId, sock] of sessions.entries()) {
      whatsappSessions.push({
        academy_id: academyId,
        connected: !!sock?.user,
        phone: sock?.user?.id ? sock.user.id.split(":")[0] : null,
        name: sock?.user?.name || null
      });
    }

    // 6. Cron stats
    const cronStatus = global.cronStatus || {
      lastJobRunStart: null,
      lastJobRunEnd: null,
      lastJobRunSuccess: null,
      lastBackupRunStart: null,
      lastBackupRunEnd: null,
      lastBackupRunSuccess: null,
      lastError: null,
      lastBackupError: null
    };

    // 7. Server memory and vitals
    const memoryUsage = process.memoryUsage();
    const serverVitals = {
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      memoryHeapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1) + " MB",
      memoryHeapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1) + " MB",
      memoryRSS: (memoryUsage.rss / 1024 / 1024).toFixed(1) + " MB",
    };

    // 8. Recent unhandled errors
    const recentErrors = global.recentErrors || [];

    res.json({
      success: true,
      db: {
        status: "healthy",
        latencyMs: dbLatency,
        pool: {
          total: dbPoolTotal,
          idle: dbPoolIdle,
          waiting: dbPoolWaiting
        }
      },
      services: {
        fcm: { initialized: fcmInitialized },
        resend: { configured: resendConfigured },
        whatsapp: {
          activeSessionsCount: sessions.size,
          sessions: whatsappSessions
        }
      },
      cron: cronStatus,
      server: serverVitals,
      recentErrors
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to collect diagnostics: " + e.message });
  }
});

router.post("/clear-errors", authenticatePlatformOwner, (req, res) => {
  global.recentErrors = [];
  res.json({ success: true, message: "Error logs cleared." });
});

module.exports = router;
