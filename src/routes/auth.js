import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

// 🔐 Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log({ username, password });
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

  const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  res.json({ token });
});

// 🛡 Middleware
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Token faltante" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

export default router;
