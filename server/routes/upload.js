const router  = require("express").Router();
const crypto  = require("crypto");
const { auth } = require("../middleware");

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/svg+xml",
  "image/x-icon", "image/vnd.microsoft.icon",
];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function getBase64Meta(dataUrl) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
  if (!match) return null;
  const mime      = match[1];
  const base64Data = dataUrl.slice(match[0].length);
  const byteLength = Math.ceil(base64Data.length * 0.75);
  return { mime, byteLength };
}

// Generate a Cloudinary signed upload signature (no preset required)
function makeSignature(params, apiSecret) {
  // Sort params alphabetically, join as key=value pairs, append secret
  const str = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&") + apiSecret;
  return crypto.createHash("sha1").update(str).digest("hex");
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/upload/photo — authenticated (student profile photos)
router.post("/photo", auth, async (req, res) => {
  return handleUpload(req, res, "nishchay_students");
});

// POST /api/upload/platform — no auth (academy logo, favicon, branding images)
router.post("/platform", async (req, res) => {
  return handleUpload(req, res, "academy_branding");
});

// ── Core upload handler ───────────────────────────────────────────────────────
async function handleUpload(req, res, folder) {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const meta = getBase64Meta(image);
  if (!meta)
    return res.status(400).json({ error: "Invalid image format. Must be a base64 data URL." });
  if (!ALLOWED_MIME_TYPES.includes(meta.mime))
    return res.status(400).json({
      error: `Invalid file type '${meta.mime}'. Allowed: JPEG, PNG, WebP, GIF, SVG, ICO.`,
    });
  if (meta.byteLength > MAX_SIZE_BYTES)
    return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Upload failed: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET not set");
    return res.status(500).json({
      error:
        "Image upload is not configured on the server. " +
        "Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Render environment variables.",
    });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Parameters to sign (must match what we send in the form — exclude file & api_key)
  const signParams = { folder, timestamp };
  const signature  = makeSignature(signParams, apiSecret);

  try {
    const formData = new URLSearchParams();
    formData.append("file",      image);
    formData.append("folder",    folder);
    formData.append("timestamp", timestamp);
    formData.append("api_key",   apiKey);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    const data = await response.json();

    if (data.error) {
      console.error("Cloudinary error:", data.error.message);
      return res.status(400).json({ error: "Upload failed: " + data.error.message });
    }

    res.json({ url: data.secure_url, public_id: data.public_id });
  } catch (e) {
    console.error("Upload network error:", e.message);
    res.status(500).json({ error: "Upload failed: " + e.message });
  }
}

module.exports = router;
