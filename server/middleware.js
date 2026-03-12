const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "secret");
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

module.exports = { auth, superAdmin, branchFilter };
