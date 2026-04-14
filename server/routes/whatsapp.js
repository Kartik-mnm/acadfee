const router = require("express").Router();
const { auth } = require("../middleware");
const { startSession, sessions, qrs } = require("../whatsapp");
const db = require("../db");

// GET /api/whatsapp/status
router.get("/status", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId || 1; // Fallback to 1 if no multi-tenant setup during dev
    
    // Explicitly initialize the session if not running
    if (!sessions.has(aid)) {
      await startSession(aid);
    }
    
    const isConnected = !!sessions.get(aid)?.user;
    res.json({
      connected: isConnected,
      user: isConnected ? sessions.get(aid).user : null
    });
  } catch (e) {
    console.error("WA Status Error:", e.message);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// GET /api/whatsapp/qr
router.get("/qr", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId || 1;
    if (!sessions.has(aid)) {
      await startSession(aid);
    }
    
    const qrDataUrl = qrs.get(aid);
    if (qrDataUrl) {
      res.json({ qr: qrDataUrl });
    } else {
      res.json({ qr: null, connected: !!sessions.get(aid)?.user });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to get QR" });
  }
});

// POST /api/whatsapp/logout
router.post("/logout", auth, async (req, res) => {
  if (req.user.role === "student") return res.status(403).json({ error: "Access denied" });
  try {
    const aid = req.academyId || 1;
    const sock = sessions.get(aid);
    
    if (sock) {
      sock.logout(); // Triggers Baileys hard logout
    } else {
      await db.query(`DELETE FROM whatsapp_sessions WHERE academy_id=$1`, [aid]);
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to logout" });
  }
});

module.exports = router;
