// scripts/fix_dates.js
import mongoose from "mongoose";
import { DateTime } from "luxon";
import Expense from "../src/models/Expense.js";
import Vehicle from "../src/models/Vehicle.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/tu_db";
const CL_ZONE = "America/Santiago";

function toChileStartUTC(jsDate) {
    if (!jsDate) return null;
    // 1) Tomamos la fecha en UTC, extraemos ymd en UTC (lo que guardaste originalmente)
    const ymdUTC = DateTime.fromJSDate(jsDate, { zone: "UTC" }).toFormat("yyyy-LL-dd");
    // 2) Reinterpretamos ese ymd como día Chile a las 00:00 y lo pasamos a UTC
    return DateTime.fromFormat(ymdUTC, "yyyy-LL-dd", { zone: CL_ZONE })
        .startOf("day")
        .toUTC()
        .toJSDate();
}

async function fixCollection(model, fields) {
    const cursor = model.find({}).cursor();
    let count = 0, touched = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        let changed = false;
        for (const f of fields) {
            const cur = doc[f];
            if (cur instanceof Date) {
                const fixed = toChileStartUTC(cur);
                if (fixed && fixed.getTime() !== cur.getTime()) {
                    doc[f] = fixed;
                    changed = true;
                }
            }
        }
        if (changed) {
            await doc.save();
            touched++;
        }
        count++;
        if (count % 500 === 0) console.log(`[${model.modelName}] procesados: ${count}, corregidos: ${touched}`);
    }
    console.log(`[${model.modelName}] TOTAL procesados: ${count}, corregidos: ${touched}`);
}

(async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Conectado a Mongo");

        // Corrige Expenses.date
        await fixCollection(Expense, ["date"]);

        // Corrige Vehicle.purchaseDate y Vehicle.soldDate (si existen esos campos)
        await fixCollection(Vehicle, ["purchaseDate", "soldDate"]);

        await mongoose.disconnect();
        console.log("Listo!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
