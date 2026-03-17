const router  = require("express").Router();
const { auth } = require("../middleware");

// Upload photo to Cloudinary via unsigned upload preset
// POST /api/upload/photo
router.post("/photo", auth, async (req, res) => {
  const { image } = req.body; // base64 data URL
  if (!image) return res.status(400).json({ error: "No image provided" });

  const cloudName    = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return res.status(500).json({ error: "Cloudinary not configured" });
  }

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
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
