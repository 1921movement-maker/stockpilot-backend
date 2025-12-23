import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import pool from "./db.js";

const router = express.Router();

// ENV VARS (must exist in Railway)
const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_APP_URL,
  SCOPES,
} = process.env;

/**
 * STEP 1 — START OAUTH
 * Shopify redirects here first
 * /auth?shop=storename.myshopify.com
 */
router.get("/auth", async (req, res) => {
  const { shop } = req.query;

  if (!shop) {
    return res.status(400).send("Missing shop parameter");
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${SHOPIFY_APP_URL}/auth/callback`;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${SHOPIFY_API_KEY}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`;

  res.redirect(installUrl);
});

/**
 * STEP 2 — OAUTH CALLBACK
 * Shopify redirects here after approval
 */
router.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;

  if (!shop || !code) {
    return res.status(400).send("Missing shop or code");
  }

  try {
    // Exchange code for access token
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

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error("No access token returned");
    }

    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    // Save shop in DB (multi-tenant safe)
    await pool.query(
      `
      INSERT INTO shops (shop, access_token, scope)
      VALUES ($1, $2, $3)
      ON CONFLICT (shop)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        scope = EXCLUDED.scope
      `,
      [shop, accessToken, scope]
    );

    // Redirect to embedded app UI
    res.redirect(`${SHOPIFY_APP_URL}/app?shop=${shop}`);
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("OAuth failed");
  }
});

export default router;
