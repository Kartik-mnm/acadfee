const jwt = require("jsonwebtoken");
const db  = require("./db");

function getJwtSecret() {
  if (!process.env.JWT_SECRET) { console.error("FATAL: JWT_SECRET env var is not set!"); process.exit(1); }
  return process.env.JWT_SECRET;
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, getJwtSecret());
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT s.login_enabled,
                (SELECT COUNT(*) FROM refresh_tokens
                 WHERE (payload->>'id')::int = s.id
                   AND payload->>'role' = 'student'
                   AND expires_at > NOW()) AS active_sessions
         FROM students s WHERE s.id = $1`, [req.user.id]
      );
      if (!rows[0]) return res.status(401).json({ error: "Student account not found" });
      if (!rows[0].login_enabled) return res.status(401).json({ error: "Student portal access is disabled" });
      if (parseInt(rows[0].active_sessions) === 0)
        return res.status(401).json({ error: "Session revoked by admin. Please log in again.", code: "SESSION_REVOKED" });
    }
    // academy_id from JWT — used to scope all queries to this academy
    req.academyId = req.user.academy_id || null;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function authenticatePlatformOwner(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== "platform_owner")
      return res.status(403).json({ error: "Access denied. Platform owner only." });
    req.platformAdmin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function superAdmin(req, res, next) {
  if (req.user.role !== "super_admin") return res.status(403).json({ error: "Super admin only" });
  next();
}

// Scope by branch AND academy
function branchFilter(req, res, next) {
  if (req.user.role === "super_admin") {
    req.branchId = req.query.branch_id ? parseInt(req.query.branch_id) : null;
  } else {
    req.branchId = req.user.branch_id;
  }
  next();
}

function studentSelf(req, res, next) {
  if (req.user.role === "student") {
    const paramId = parseInt(req.params.id);
    if (paramId && paramId !== req.user.id)
      return res.status(403).json({ error: "Access denied: you can only view your own data" });
    req.forcedStudentId = req.user.id;
  }
  next();
}

module.exports = { auth, superAdmin, branchFilter, studentSelf, getJwtSecret, authenticatePlatformOwner };
