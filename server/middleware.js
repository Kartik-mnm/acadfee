const jwt = require("jsonwebtoken");

// #1 — JWT secret MUST be set via env — no fallback to "secret"
function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET env var is not set!");
    process.exit(1);
  }
  return process.env.JWT_SECRET;
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function superAdmin(req, res, next) {
  if (req.user.role !== "super_admin")
    return res.status(403).json({ error: "Super admin only" });
  next();
}

// Inject branch filter: super_admin can pass ?branch_id=, branch_manager locked to own branch
function branchFilter(req, res, next) {
  if (req.user.role === "super_admin") {
    req.branchId = req.query.branch_id ? parseInt(req.query.branch_id) : null;
  } else {
    req.branchId = req.user.branch_id;
  }
  next();
}

// #5 — Student access control: students can only see their own data
function studentSelf(req, res, next) {
  if (req.user.role === "student") {
    // For routes with :id param, enforce student can only access own record
    const paramId = parseInt(req.params.id);
    if (paramId && paramId !== req.user.id) {
      return res.status(403).json({ error: "Access denied: you can only view your own data" });
    }
    // For list routes, force student_id filter to self
    req.forcedStudentId = req.user.id;
  }
  next();
}

module.exports = { auth, superAdmin, branchFilter, studentSelf, getJwtSecret };
