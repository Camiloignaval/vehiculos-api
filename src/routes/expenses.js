import { Router } from "express";
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import { authMiddleware } from "./auth.js";

const router = Router();
router.use(authMiddleware);

// Listar gastos (opcional: filtrar por vehículo)
router.get("/", async (req, res) => {
  try {
    const { vehicleId } = req.query;
    const q = vehicleId ? { vehicleId } : {};
    const items = await Expense.find(q).sort({ date: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear gasto
router.post("/", async (req, res) => {
  try {
    const { vehicleId, date, name, amount } = req.body;
    if (!vehicleId || !date || !name || amount == null) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    const item = await Expense.create({ vehicleId, date, name, amount });
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Eliminar gasto
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Gasto no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const rows = await Expense.aggregate([
      { $group: { _id: "$vehicleId", total: { $sum: "$amount" } } },
    ]);
    // normalizamos a diccionario
    const map = {};
    for (const r of rows) map[String(r._id)] = r.total || 0;
    res.json(map);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
