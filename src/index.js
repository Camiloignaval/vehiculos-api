import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import path from "path"; // 👈 agrega esto
import { connectDB } from "./db.js";

import authRoute from "./routes/auth.js";
import vehiclesRoute from "./routes/vehicles.js";
import expensesRoute from "./routes/expenses.js";
import metricsRoute from "./routes/metrics.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.send("🚗 API Vehículos funcionando"));
app.use("/api/auth", authRoute);
app.use("/api/vehicles", vehiclesRoute);
app.use("/api/expenses", expensesRoute);
app.use("/api/metrics", metricsRoute);

// sirve archivos si algún día guardas en /uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const PORT = process.env.PORT || 9494;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () =>
    console.log(`🚀 API corriendo en http://localhost:${PORT}`)
  );
});
