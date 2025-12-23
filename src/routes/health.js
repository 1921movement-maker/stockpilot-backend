import { Router } from "express";
const r = Router();

r.get("/", (req, res) => res.send("StockPilot backend OK"));
r.get("/health", (req, res) => res.json({ ok: true }));

export default r;
