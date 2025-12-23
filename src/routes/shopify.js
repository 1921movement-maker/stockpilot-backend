import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import pool from "./db.js";

const router = express.Router();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES,
  SHOPIFY_APP_URL,
} = process.env;

// STEP 1: Begin OAuth
router.get("/auth", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop");

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_API_KEY}` +
    `&scope=${SHOPIFY_SCOPES}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`;

  res.redirect(installUrl);
});

// STEP 2: OAuth callback
router.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send("Missing params");

  const tokenRes = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    }
  );

  const { access_token, scope } = await tokenRes.json();

  // Save or update shop
  await pool.query(
    `
    INSERT INTO shops (shop, access_token, scope)
    VALUES ($1, $2, $3)
    ON CONFLICT (shop)
    DO UPDATE SET access_token = EXCLUDED.access_token,
                  scope = EXCLUDED.scope
    `,
    [shop, access_token, scope]
  );

  res.send("✅ StockPilot installed successfully");
});

export default router;

