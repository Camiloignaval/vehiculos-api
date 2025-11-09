// src/routes/metrics.js
import { Router } from "express";
import Vehicle from "../models/Vehicle.js";
import Expense from "../models/Expense.js";
import { authMiddleware } from "./auth.js";
import { DateTime } from "luxon";

const router = Router();
router.use(authMiddleware);

const CL_ZONE = "America/Santiago";

function buildRangeCLtoUTC(startYMD, endYMD) {
  if (!startYMD) return null;
  const end = endYMD || startYMD;
  const startUTC = DateTime.fromFormat(startYMD, "yyyy-LL-dd", { zone: CL_ZONE }).startOf("day").toUTC();
  const endUTC = DateTime.fromFormat(end, "yyyy-LL-dd", { zone: CL_ZONE }).endOf("day").toUTC();
  if (!startUTC.isValid || !endUTC.isValid) return null;
  return { start: startUTC.toJSDate(), end: endUTC.toJSDate() };
}
function buildRangeUTC(startYMD, endYMD) {
  if (!startYMD) return null;
  const end = endYMD || startYMD;
  const startUTC = DateTime.fromFormat(startYMD, "yyyy-LL-dd", { zone: "UTC" }).startOf("day");
  const endUTC = DateTime.fromFormat(end, "yyyy-LL-dd", { zone: "UTC" }).endOf("day");
  if (!startUTC.isValid || !endUTC.isValid) return null;
  return { start: startUTC.toJSDate(), end: endUTC.toJSDate() };
}
function inEitherRange(date, rangeA, rangeB) {
  if (!date) return false;
  const t = date.getTime();
  const a = rangeA ? (t >= rangeA.start.getTime() && t <= rangeA.end.getTime()) : false;
  const b = rangeB ? (t >= rangeB.start.getTime() && t <= rangeB.end.getTime()) : false;
  return a || b;
}

router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;

    const hasRange = Boolean(startDate);
    const rangeCL = hasRange ? buildRangeCLtoUTC(startDate, endDate) : null;
    const rangeUTC = hasRange ? buildRangeUTC(startDate, endDate) : null;
    if (hasRange && (!rangeCL || !rangeUTC)) {
      return res.status(400).json({ error: "Fechas inválidas. Formato esperado: YYYY-MM-DD" });
    }

    const vehFilter = vehicleId ? { _id: vehicleId } : {};
    const vehicles = await Vehicle.find(vehFilter).lean();

    // Gastos en rango (operativos)
    const expRangeQuery = {};
    if (vehicleId) expRangeQuery.vehicleId = vehicleId;
    if (hasRange) {
      expRangeQuery.$or = [
        { date: { $gte: rangeCL.start, $lte: rangeCL.end } },
        { date: { $gte: rangeUTC.start, $lte: rangeUTC.end } },
      ];
    }
    const expensesRange = await Expense.find(expRangeQuery).lean();

    // Gastos globales (para inversión global)
    const expAllQuery = {};
    if (vehicleId) expAllQuery.vehicleId = vehicleId;
    const expensesAll = await Expense.find(expAllQuery).lean();

    // Helpers
    const sumBy = (rows, keyField, valField = "amount") => {
      const acc = {};
      for (const r of rows) {
        const key = String(r[keyField]);
        acc[key] = (acc[key] || 0) + Number(r[valField] || 0);
      }
      return acc;
    };

    const opByVehRange = sumBy(expensesRange, "vehicleId");
    const opByVehAll = sumBy(expensesAll, "vehicleId");

    let totalOpExpenses = 0;
    let totalExpenses = 0;
    let totalIngresos = 0;
    let totalInversionGlobal = 0;
    let totalInversionRange = 0;

    const perVehicle = [];
    let soldCountForAvg = 0;
    let soldDaysAcc = 0;

    for (const v of vehicles) {
      const vid = String(v._id);
      const purchasePrice = Number(v.purchasePrice || 0);
      const soldPrice = Number(v.soldPrice || 0);

      const opRange = opByVehRange[vid] || 0;
      const opAll = opByVehAll[vid] || 0;

      const purchaseInRange =
        !hasRange || inEitherRange(v.purchaseDate, rangeCL, rangeUTC);

      const gastosVehiculoRango = opRange + (purchaseInRange ? purchasePrice : 0);
      const investedGlobal = purchasePrice + opAll;
      const investedRange = gastosVehiculoRango;

      const soldInRange =
        v.soldDate && (!hasRange || inEitherRange(v.soldDate, rangeCL, rangeUTC));

      const income = soldInRange ? soldPrice : 0;
      const profit = income - gastosVehiculoRango;

      perVehicle.push({
        id: vid,
        name: v.name,
        patente: v.patente,
        opExpenses: opRange,
        expenses: gastosVehiculoRango,
        invested: investedGlobal,
        investedRange,
        income,
        profit,
      });

      totalOpExpenses += opRange;
      totalExpenses += gastosVehiculoRango;
      totalInversionGlobal += investedGlobal;
      totalInversionRange += investedRange;
      totalIngresos += income;

      if (soldInRange && v.purchaseDate) {
        const days = (v.soldDate.getTime() - v.purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        soldDaysAcc += Math.max(0, Math.round(days));
        soldCountForAvg += 1;
      }
    }

    const avgDaysToSell = soldCountForAvg ? Math.round(soldDaysAcc / soldCountForAvg) : 0;

    res.json({
      totalOpExpenses,
      totalExpenses,
      totalIngresos,
      totalInversionGlobal,
      totalInversionRange,
      totalProfit: totalIngresos - totalExpenses,
      avgDaysToSell,
      perVehicle,
      filters: { startDate, endDate: endDate || startDate, vehicleId: vehicleId || null },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
