import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import Vehicle from "../models/Vehicle.js";
import { authMiddleware } from "./auth.js";
import cloudinary from "../lib/cloudinary.js";

const router = Router();
router.use(authMiddleware);

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/vehicles?showAll=true
router.get("/", async (req, res) => {
  const { showAll } = req.query;
  const filter = showAll === "true" ? {} : { soldDate: null };
  const items = await Vehicle.find(filter).sort({
    purchaseDate: -1,
    createdAt: -1,
  });
  res.json(items);
});

// POST /api/vehicles  (multipart con campo "image")
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, patente, purchaseDate, purchasePrice } = req.body;
    if (!name || !patente || !purchaseDate || purchasePrice == null) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    const exists = await Vehicle.findOne({ patente });
    if (exists) return res.status(400).json({ error: "Ya existe esa patente" });

    let imageUrl = null;
    if (req.file) {
      imageUrl = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: `vehiculosApp/${patente}`,
              resource_type: "image",
              overwrite: true,
              unique_filename: false,
              public_id: patente,
            },
            (err, result) => (err ? reject(err) : resolve(result.secure_url))
          )
          .end(req.file.buffer);
      });
    }

    const doc = await Vehicle.create({
      name,
      patente,
      purchaseDate,
      purchasePrice: Number(purchasePrice),
      imageUrl,
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/vehicles/:id/sell
router.patch("/:id/sell", async (req, res) => {
  const { id } = req.params;
  const { soldPrice, soldDate } = req.body;
  if (!mongoose.isValidObjectId(id))
    return res.status(400).json({ error: "ID inválido" });
  const updated = await Vehicle.findByIdAndUpdate(
    id,
    {
      soldPrice: Number(soldPrice),
      soldDate: soldDate ? new Date(soldDate) : new Date(),
    },
    { new: true }
  );
  if (!updated)
    return res.status(404).json({ error: "Vehículo no encontrado" });
  res.json(updated);
});

export default router; // 👈 IMPORTANTE
