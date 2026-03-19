const router  = require("express").Router();
const { auth } = require("../middleware");

// Allowed image MIME types (checked before sending to Cloudinary) — #10
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function getBase64Meta(dataUrl) {
  // dataUrl format: "data:<mime>;base64,<data>"
  const match = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
  if (!match) return null;
  const mime = match[1];
  const base64Data = dataUrl.slice(match[0].length);
  const byteLength = Math.ceil(base64Data.length * 0.75); // approx decoded size
  return { mime, byteLength };
}

// Upload photo to Cloudinary via unsigned upload preset
// POST /api/upload/photo
router.post("/photo", auth, async (req, res) => {
  const { image } = req.body; // base64 data URL
  if (!image) return res.status(400).json({ error: "No image provided" });

  // Validate type and size before hitting Cloudinary (#10)
  const meta = getBase64Meta(image);
  if (!meta) return res.status(400).json({ error: "Invalid image format. Must be a base64 data URL." });
  if (!ALLOWED_MIME_TYPES.includes(meta.mime))
    return res.status(400).json({ error: `Invalid file type '${meta.mime}'. Allowed: JPEG, PNG, WebP, GIF.` });
  if (meta.byteLength > MAX_SIZE_BYTES)
    return res.status(400).json({ error: "Image too large. Maximum size is 5 MB." });

  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset)
    return res.status(500).json({ error: "Cloudinary not configured" });

  try {
    const formData = new URLSearchParams();
    formData.append("file", image);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "nishchay_students");
    formData.append("transformation", "w_400,h_400,c_fill,g_face,q_auto,f_auto");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json({ url: data.secure_url, public_id: data.public_id });
  } catch (e) {
    console.error("Upload error:", e.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
