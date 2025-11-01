import { Router } from "express";
import Vehicle from "../models/Vehicle.js";
import Expense from "../models/Expense.js";
import { authMiddleware } from "./auth.js";

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/metrics
 * Query:
 *  - startDate, endDate (YYYY-MM-DD)
 *  - vehicleId (opcional)
 *
 * Definiciones:
 *  - totalOpExpenses:        SOLO gastos operativos en el rango (NO compra)
 *  - totalExpenses:          gastos operativos en rango + compra si purchaseDate cae en rango
 *  - totalInversionGlobal:   (compra + TODOS los gastos operativos históricos)  ← sin rango
 *  - totalIngresos:          soldPrice si soldDate en rango (o todos si no hay rango)
 *  - perVehicle:
 *      - opExpenses:   operativos en rango
 *      - expenses:     total en rango (op + compra si cae en rango)
 *      - invested:     global (compra + op históricos)
 *      - income, profit (profit = income - expenses)
 */
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, vehicleId } = req.query;

    const hasRange = Boolean(startDate && endDate);
    const rangeStart = hasRange ? new Date(startDate) : null;
    const rangeEnd = hasRange ? new Date(endDate) : null;

    // Vehículos (filtrados por vehicleId si corresponde)
    const vehFilter = vehicleId ? { _id: vehicleId } : {};
    const vehicles = await Vehicle.find(vehFilter).lean();
    const ids = vehicles.map((v) => String(v._id));

    // Gastos en rango (para métricas del rango)
    const expRangeQuery = {};
    if (vehicleId) expRangeQuery.vehicleId = vehicleId;
    if (hasRange) expRangeQuery.date = { $gte: rangeStart, $lte: rangeEnd };
    const expensesRange = await Expense.find(expRangeQuery).lean();

    // Gastos globales (sin rango) para inversión global
    const expAllQuery = {};
    if (vehicleId) expAllQuery.vehicleId = vehicleId;
    const expensesAll = await Expense.find(expAllQuery).lean();

    // Acumuladores por vehículo
    const sumBy = (rows, keyField, valField = "amount") => {
      const acc = {};
      for (const r of rows) {
        const key = String(r[keyField]);
        acc[key] = (acc[key] || 0) + Number(r[valField] || 0);
      }
      return acc;
    };

    const opByVehRange = sumBy(expensesRange, "vehicleId"); // operativos (rango)
    const opByVehAll = sumBy(expensesAll, "vehicleId"); // operativos (global)

    let totalOpExpenses = 0; // SOLO operativos (rango)
    let totalExpenses = 0; // operativos + compra si cae en rango
    let totalIngresos = 0;
    let totalInversionGlobal = 0; // compra + op (global)

    const perVehicle = [];

    // Promedio días a la venta (por vendidos en rango si hay rango)
    let soldCountForAvg = 0;
    let soldDaysAcc = 0;

    for (const v of vehicles) {
      const vid = String(v._id);
      const purchasePrice = Number(v.purchasePrice || 0);
      const soldPrice = Number(v.soldPrice || 0);

      // Operativos
      const opRange = opByVehRange[vid] || 0; // en rango
      const opAll = opByVehAll[vid] || 0; // global

      // Compra en rango
      const purchaseInRange =
        !hasRange ||
        (v.purchaseDate &&
          new Date(v.purchaseDate) >= rangeStart &&
          new Date(v.purchaseDate) <= rangeEnd);

      // Gastos totales del rango = op (rango) + compra si la compra cae en el rango
      const gastosVehiculoRango =
        opRange + (purchaseInRange ? purchasePrice : 0);

      // Inversión global = compra + op históricos
      const investedGlobal = purchasePrice + opAll;

      // Ingresos (rango si hay)
      const soldInRange =
        v.soldDate &&
        (!hasRange ||
          (new Date(v.soldDate) >= rangeStart &&
            new Date(v.soldDate) <= rangeEnd));
      const income = soldInRange ? soldPrice : 0;

      // Profit usando la definición de gastos del rango (incluye compra si cae)
      const profit = income - gastosVehiculoRango;

      perVehicle.push({
        id: vid,
        name: v.name,
        patente: v.patente,
        opExpenses: opRange, // SOLO operativos (rango) → barras/KPI Gastos
        expenses: gastosVehiculoRango, // total (rango) → dona
        invested: investedGlobal, // global → KPI Inversión total (global)
        income,
        profit,
      });

      totalOpExpenses += opRange;
      totalExpenses += gastosVehiculoRango;
      totalInversionGlobal += investedGlobal;
      totalIngresos += income;

      if (soldInRange && v.purchaseDate) {
        const days =
          (new Date(v.soldDate).getTime() -
            new Date(v.purchaseDate).getTime()) /
          (1000 * 60 * 60 * 24);
        soldDaysAcc += Math.max(0, Math.round(days));
        soldCountForAvg += 1;
      }
    }

    const avgDaysToSell = soldCountForAvg
      ? Math.round(soldDaysAcc / soldCountForAvg)
      : 0;

    res.json({
      // Totales para KPIs
      totalOpExpenses, // ← KPI "Gastos" (solo operativos)
      totalExpenses, // total (rango) por si lo necesitas
      totalIngresos,
      totalInversionGlobal, // ← KPI "Inversión total (global)"
      totalProfit: totalIngresos - totalExpenses,
      avgDaysToSell,

      perVehicle,
      filters: { startDate, endDate, vehicleId: vehicleId || null },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
