import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { AppError } from "./utility/AppError";
import contacts from "./routes/contacts";
import verify from "./routes/verify";
import pda from "./routes/pda";

const app = new Hono<{ Bindings: Env }>();

app.use(logger());
app.use("/api/*", secureHeaders());
app.use("/api/*", cors({ allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], maxAge: 600 }));
app.use(
  "/api/*",
  bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ success: false, message: "Request body too large" }, 413) }),
);

// -------------------------------------------------------------
// Routes
// -------------------------------------------------------------
const api = new Hono<{ Bindings: Env }>();

api.get("/", (c) => c.json({ success: true, message: "Welcome to Address Book API" }));
api.get("/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));
api.route("/contacts", contacts);
api.route("/verify-ownership", verify);
api.route("/derive-pda", pda);

app.route("/api", api);

// -------------------------------------------------------------
// Global Error Handler
// -------------------------------------------------------------
app.onError((err, c) => {
  const isHttp = err instanceof HTTPException;
  const status = isHttp ? err.status : 500;
  const message = isHttp ? err.message : "Internal Server Error";
  const details = err instanceof AppError ? err.details : undefined;

  if (!isHttp) console.error("Unhandled Error:", err);

  return c.json({ success: false, message, ...(details ? { details } : {}) }, status);
});

// -------------------------------------------------------------
// 404 Not Found Handler
// -------------------------------------------------------------
app.notFound((c) =>
  c.json({ success: false, message: `Resource not found: ${c.req.method} ${c.req.path}` }, 404),
);

export default app;
