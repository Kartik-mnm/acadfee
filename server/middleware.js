const jwt = require("jsonwebtoken");
const db  = require("./db");

// JWT secret — crashes on startup if not set
function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET env var is not set!");
    process.exit(1);
  }
  return process.env.JWT_SECRET;
}

// ── auth middleware ────────────────────────────────────────────────────────────
async function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, getJwtSecret());

    // Fix #2 — For student tokens, verify the student still has login access.
    // This ensures that when an admin revokes a session (deletes refresh token),
    // the student's device gets a 401 on the NEXT API call (not just after 12h).
    // We check that:
    //   a) login_enabled is still true
    //   b) at least one valid refresh token still exists for this student
    //      (i.e. admin hasn't revoked all sessions)
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT s.login_enabled,
                (SELECT COUNT(*) FROM refresh_tokens
                 WHERE (payload->>'id')::int = s.id
                   AND payload->>'role' = 'student'
                   AND expires_at > NOW()) AS active_sessions
         FROM students s WHERE s.id = $1`,
        [req.user.id]
      );
      if (!rows[0]) return res.status(401).json({ error: "Student account not found" });
      if (!rows[0].login_enabled) return res.status(401).json({ error: "Student portal access is disabled" });
      // If admin has revoked all sessions (0 active refresh tokens), force re-login
      if (parseInt(rows[0].active_sessions) === 0) {
        return res.status(401).json({ error: "Session revoked by admin. Please log in again.", code: "SESSION_REVOKED" });
      }
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Restrict to super admins only
function superAdmin(req, res, next) {
  if (req.user.role !== "super_admin")
    return res.status(403).json({ error: "Super admin only" });
  next();
}

// Inject branch filter based on role
function branchFilter(req, res, next) {
  if (req.user.role === "super_admin") {
    req.branchId = req.query.branch_id ? parseInt(req.query.branch_id) : null;
  } else {
    req.branchId = req.user.branch_id;
  }
  next();
}

// Students can only access their own record
function studentSelf(req, res, next) {
  if (req.user.role === "student") {
    const paramId = parseInt(req.params.id);
    if (paramId && paramId !== req.user.id) {
      return res.status(403).json({ error: "Access denied: you can only view your own data" });
    }
    req.forcedStudentId = req.user.id;
  }
  next();
}

module.exports = { auth, superAdmin, branchFilter, studentSelf, getJwtSecret };
