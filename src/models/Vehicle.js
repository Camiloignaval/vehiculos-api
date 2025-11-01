import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    patente: { type: String, required: true, unique: true },
    purchaseDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true },
    soldDate: { type: Date, default: null },
    soldPrice: { type: Number, default: null },
    imageUrl: { type: String, default: null }, // 👈 thumbnail (URL público)
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", VehicleSchema);
