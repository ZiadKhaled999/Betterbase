import { Hono } from "hono";
import { requireAdmin } from "../../lib/admin-middleware";
import { authRoutes } from "./auth";
import { functionRoutes } from "./functions";
import { logRoutes } from "./logs";
import { metricsRoutes } from "./metrics";
import { projectRoutes } from "./projects";
import { storageRoutes } from "./storage";
import { userRoutes } from "./users";
import { webhookRoutes } from "./webhooks";

export const adminRouter = new Hono();

// Auth routes are public (login doesn't require a token)
adminRouter.route("/auth", authRoutes);

// All other admin routes require a valid admin token
adminRouter.use("/*", requireAdmin);
adminRouter.route("/projects", projectRoutes);
adminRouter.route("/users", userRoutes);
adminRouter.route("/metrics", metricsRoutes);
adminRouter.route("/storage", storageRoutes);
adminRouter.route("/webhooks", webhookRoutes);
adminRouter.route("/functions", functionRoutes);
adminRouter.route("/logs", logRoutes);
