const router  = require("express").Router();
const https   = require("https");
const crypto  = require("crypto");
const { auth, authenticatePlatformOwner } = require("../middleware");

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "image/gif",  "image/svg+xml",
  "image/x-icon", "image/vnd.microsoft.icon",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function getBase64Meta(dataUrl) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
  if (!match) return null;
  const mime       = match[1];
  const base64Data = dataUrl.slice(match[0].length);
  const byteLength = Math.ceil(base64Data.length * 0.75);
  return { mime, byteLength };
}

// Cloudinary signed upload signature
function makeSignature(params, apiSecret) {
  const str = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&") + apiSecret;
  return crypto.createHash("sha1").update(str).digest("hex");
}

// HTTPS POST helper — avoids fetch() which is unavailable on older Node.js
function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === "string" ? body : body.toString();
    const options = {
      hostname,
      path,
      method:  "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── POST /api/upload/photo — authenticated (student profile photos)
router.post("/photo", auth, async (req, res) => {
  return handleUpload(req, res, "nishchay_students");
});

// ── POST /api/upload/platform — platform owner only (logo, favicon, branding)
router.post("/platform", authenticatePlatformOwner, async (req, res) => {
  return handleUpload(req, res, "academy_branding");
});

// ── Core upload handler ────────────────────────────────────────────────────────
async function handleUpload(req, res, folder) {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const meta = getBase64Meta(image);
  if (!meta)
    return res.status(400).json({ error: "Invalid image format. Must be a base64 data URL." });
  if (!ALLOWED_MIME_TYPES.includes(meta.mime))
    return res.status(400).json({ error: `Invalid file type '${meta.mime}'. Allowed: JPEG, PNG, WebP, GIF, SVG, ICO.` });
  if (meta.byteLength > MAX_SIZE_BYTES)
    return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[upload] Missing Cloudinary env vars");
    return res.status(500).json({
      error: "Image upload not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to Render environment variables.",
    });
  }

  const timestamp  = Math.floor(Date.now() / 1000).toString();
  const signParams = { folder, timestamp };
  const signature  = makeSignature(signParams, apiSecret);

  try {
    const params = new URLSearchParams();
    params.append("file",      image);
    params.append("folder",    folder);
    params.append("timestamp", timestamp);
    params.append("api_key",   apiKey);
    params.append("signature", signature);

    const data = await httpsPost(
      "api.cloudinary.com",
      `/v1_1/${cloudName}/image/upload`,
      params
    );

    if (data.error) {
      console.error("[upload] Cloudinary error:", data.error.message);
      return res.status(400).json({ error: "Upload failed: " + data.error.message });
    }

    res.json({ url: data.secure_url, public_id: data.public_id });
  } catch (e) {
    console.error("[upload] Network error:", e.message);
    res.status(500).json({ error: "Upload failed: " + e.message });
  }
}

module.exports = router;
