import dotenv from "dotenv/config";
import express from "express";
import cors from "cors";

import healthRoutes from "./routes/health.js";
import shopifyRoutes from "./routes/shopify.js";
import pool from "./routes/db.js";


const app = express();
app.use(cors());
app.use(express.json());

// --- DB bootstrap (multi-tenant: one row per shop) ---
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id SERIAL PRIMARY KEY,
      shop TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      scope TEXT,
      installed_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("DB ready: shops");
})();

app.get("/health", async (req, res) => {
  res.json({
    status: "ok",
    service: "stockpilot-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/", healthRoutes);
app.use("/", shopifyRoutes);

// Later we add:
// /api/auth (OAuth install)
// /api/webhooks
// /api/billing
// /api/sync
// /api/inventory

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`StockPilot backend running on :${port}`));
