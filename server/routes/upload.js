const router  = require("express").Router();
const { auth } = require("../middleware");

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function getBase64Meta(dataUrl) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
  if (!match) return null;
  const mime = match[1];
  const base64Data = dataUrl.slice(match[0].length);
  const byteLength = Math.ceil(base64Data.length * 0.75);
  return { mime, byteLength };
}

// POST /api/upload/photo — authenticated (academy portal)
router.post("/photo", auth, async (req, res) => {
  return handleUpload(req, res, "nishchay_students");
});

// POST /api/upload/platform — NO auth required (used by Exponent panel for logo/favicon)
// The platform panel uses its own platform JWT, not the academy JWT
router.post("/platform", async (req, res) => {
  return handleUpload(req, res, "exponent_platform");
});

async function handleUpload(req, res, folder) {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "No image provided" });

  const meta = getBase64Meta(image);
  if (!meta) return res.status(400).json({ error: "Invalid image format. Must be a base64 data URL." });
  if (!ALLOWED_MIME_TYPES.includes(meta.mime))
    return res.status(400).json({ error: `Invalid file type '${meta.mime}'. Allowed: JPEG, PNG, WebP, GIF, SVG, ICO.` });
  if (meta.byteLength > MAX_SIZE_BYTES)
    return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });

  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset)
    return res.status(500).json({ error: "Cloudinary not configured on server. Please set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET env vars." });

  try {
    const formData = new URLSearchParams();
    formData.append("file", image);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ url: data.secure_url, public_id: data.public_id });
  } catch (e) {
    console.error("Upload error:", e.message);
    res.status(500).json({ error: "Upload failed: " + e.message });
  }
}

module.exports = router;
