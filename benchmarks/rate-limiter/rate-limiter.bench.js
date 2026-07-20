import { bench, run } from "mitata";
import express from "express";
import supertest from "supertest";
import legacyRateLimit from "express-rate-limit";
import { MemoryStore } from "../dist/rate-limiter/variants/memory-store.js";
import { expressRateLimit } from "../dist/rate-limiter/adapters/express.js";

const WINDOW_MS = 60_000;
const MAX = 1_000_000; // Prevent hitting the limit during the benchmark.

// -------------------------------------
// Legacy
// -------------------------------------
const appLegacy = express();

appLegacy.use(
  legacyRateLimit({
    windowMs: WINDOW_MS,
    max: MAX,
    standardHeaders: true,
    legacyHeaders: false
  })
);

appLegacy.get("/", (_, res) => res.sendStatus(200));

const legacyRequest = supertest(appLegacy);

// -------------------------------------
// Blockend
// -------------------------------------
const appBlockend = express();

appBlockend.use(
  expressRateLimit({
    windowMs: WINDOW_MS,
    max: MAX,
    standardHeaders: true,
    store: new MemoryStore()
  })
);

appBlockend.get("/", (_, res) => res.sendStatus(200));

const blockendRequest = supertest(appBlockend);

// -------------------------------------
// Warm-up
// -------------------------------------
await legacyRequest.get("/");
await blockendRequest.get("/");

console.log("🔥 Express Integration Benchmark\n");

bench("express-rate-limit", async () => {
  await legacyRequest.get("/");
});

bench("blockend-rate-limit", async () => {
  await blockendRequest.get("/");
});

await run();
