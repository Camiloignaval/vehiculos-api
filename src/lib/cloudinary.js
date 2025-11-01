import dotenv from "dotenv";
dotenv.config(); // 👈 asegura que las envs estén listas aquí

import { v2 as cloudinary } from "cloudinary";

// Validación amistosa
for (const k of [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
]) {
  if (!process.env[k]) {
    throw new Error(
      `[Cloudinary] Falta la variable ${k}. Revisa tu server/.env o variables de entorno del deploy.`
    );
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
