import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { registerAuthRoutes } from "./auth/routes";
import { verifySessionToken } from "./auth/jwt";
import { registerBillingRoutes } from "./billing/routes";
import { registerWebhookRoutes } from "./webhooks/routes";
import { registerEntitlementRoutes } from "./entitlements/routes";
import { registerPortalRoutes } from "./portal/routes";
import { registerAskRoutes } from "./ask/routes";
import { ensureOllamaStarted } from "./ollamaStarter";

const app = Fastify({
  logger: true
});

// Custom parser: store raw body for Stripe webhook signature verification (fastify-raw-body was unreliable)
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, payload, done) => {
  req.rawBody = payload as Buffer;
  try {
    const str = (payload as Buffer).toString("utf8");
    done(null, str ? JSON.parse(str) : {});
  } catch (err) {
    done(err as Error, undefined);
  }
});

const corsOrigins = config.APP_ORIGINS
  ? [config.APP_ORIGIN, ...config.APP_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)]
  : [config.APP_ORIGIN];
app.register(cors, {
  origin: corsOrigins,
  credentials: true
});

app.decorate(
  "authenticate",
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      reply.code(401).send({ error: "Missing bearer token" });
      return;
    }

    try {
      const token = header.slice("Bearer ".length);
      const claims = await verifySessionToken(token);
      request.user = { id: claims.sub, email: claims.email };
    } catch {
      reply.code(401).send({ error: "Invalid token" });
    }
  }
);

app.get("/health", async () => {
  return {
    ok: true,
    service: "multi-agent-backend",
    redirect_uri: config.GOOGLE_REDIRECT_URI
  };
});

async function bootstrap(): Promise<void> {
  ensureOllamaStarted().catch(() => {});
  await registerAuthRoutes(app);
  await registerBillingRoutes(app);
  await registerWebhookRoutes(app);
  await registerEntitlementRoutes(app);
  await registerPortalRoutes(app);
  await registerAskRoutes(app);

  await app.listen({ host: "0.0.0.0", port: config.PORT });
  app.log.info(`Google OAuth redirect_uri: ${config.GOOGLE_REDIRECT_URI} — добавь этот URL в Google Console`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
