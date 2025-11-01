import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import { connectDB } from "./db.js";

dotenv.config();

async function run() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    console.log("❌ Uso correcto:");
    console.log("   npm run create-user <usuario> <contraseña>");
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URI);

  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`⚠️  El usuario '${username}' ya existe.`);
    process.exit(0);
  }

  const user = await User.create({ username, password }); // sin hash aquí

  console.log(
    `✅ Usuario creado exitosamente en '${mongoose.connection.name}':`
  );
  console.log(`   Usuario: ${user.username}`);
  console.log(`   ID: ${user._id}`);

  await mongoose.disconnect();
  process.exit(0);
}

run();
