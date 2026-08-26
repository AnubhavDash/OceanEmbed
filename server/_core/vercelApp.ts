import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Slim API-only app for Vercel Functions. Manus OAuth and the local storage
 * proxy are intentionally omitted: Vercel should receive its own secret and
 * database configuration, while immutable evidence is served from object URLs.
 */
export function createVercelApiApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
