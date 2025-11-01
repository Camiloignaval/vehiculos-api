import dotenv from "dotenv";
import { connectDB } from "./index.js"; // no importa el server, sólo abre conexión
import mongoose from "mongoose";
import Expense from "./models/Expense.js";
import Vehicle from "./models/Vehicle.js";

dotenv.config();
async function run() {
  await connectDB(process.env.MONGO_URI); // reaprovecha conexión del server
  await Vehicle.deleteMany({});
  await Expense.deleteMany({});

  const v1 = await Vehicle.create({
    name: "Mazza 3 S4194",
    purchaseDate: "2025-10-01",
    purchasePrice: 4500000,
  });
  const v2 = await Vehicle.create({
    name: "Toyota Hilux KJ-12-34",
    purchaseDate: "2025-09-15",
    purchasePrice: 9800000,
    soldDate: "2025-10-10",
    soldPrice: 11500000,
  });

  await Expense.create([
    {
      vehicleId: v2._id,
      date: "2025-09-18",
      name: "Mantención menor",
      amount: 120000,
    },
    { vehicleId: v2._id, date: "2025-10-02", name: "Detailing", amount: 50000 },
  ]);

  console.log("✅ Seed listo");
  await mongoose.disconnect();
  process.exit(0);
}
run();
