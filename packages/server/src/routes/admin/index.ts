import { Hono } from "hono";
import { requireAdmin } from "../../lib/admin-middleware";
import { apiKeyRoutes } from "./api-keys";
import { auditRoutes } from "./audit";
import { authRoutes } from "./auth";
import { cliSessionRoutes } from "./cli-sessions";
import { functionRoutes } from "./functions";
import { instanceRoutes } from "./instance";
import { logRoutes } from "./logs";
import { metricsRoutes } from "./metrics";
import { metricsEnhancedRoutes } from "./metrics-enhanced";
import { notificationRoutes } from "./notifications";
import { projectScopedRouter } from "./project-scoped/index";
import { projectRoutes } from "./projects";
import { roleRoutes } from "./roles";
import { smtpRoutes } from "./smtp";
import { storageRoutes } from "./storage";
import { userRoutes } from "./users";
import { webhookRoutes } from "./webhooks";

export const adminRouter = new Hono();

// Auth routes are public (login doesn't require a token)
adminRouter.route("/auth", authRoutes);

// All other admin routes require a valid admin token
adminRouter.use("/*", requireAdmin);

adminRouter.route("/projects", projectRoutes);
adminRouter.route("/projects", projectScopedRouter);
adminRouter.route("/users", userRoutes);
adminRouter.route("/metrics", metricsRoutes);
adminRouter.route("/metrics", metricsEnhancedRoutes);
adminRouter.route("/storage", storageRoutes);
adminRouter.route("/webhooks", webhookRoutes);
adminRouter.route("/functions", functionRoutes);
adminRouter.route("/logs", logRoutes);
adminRouter.route("/instance", instanceRoutes);
adminRouter.route("/smtp", smtpRoutes);
adminRouter.route("/roles", roleRoutes);
adminRouter.route("/api-keys", apiKeyRoutes);
adminRouter.route("/cli-sessions", cliSessionRoutes);
adminRouter.route("/audit", auditRoutes);
adminRouter.route("/notifications", notificationRoutes);
