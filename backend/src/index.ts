import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rawBody from "fastify-raw-body";
import { config } from "./config";
import { registerAuthRoutes } from "./auth/routes";
import { verifySessionToken } from "./auth/jwt";
import { registerBillingRoutes } from "./billing/routes";
import { registerWebhookRoutes } from "./webhooks/routes";
import { registerEntitlementRoutes } from "./entitlements/routes";
import { registerPortalRoutes } from "./portal/routes";
import { registerAskRoutes } from "./ask/routes";

const app = Fastify({
  logger: true
});

app.register(cors, {
  origin: [config.APP_ORIGIN],
  credentials: true
});

app.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
  routes: ["/webhooks/stripe"]
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
  return { ok: true, service: "multi-agent-backend" };
});

async function bootstrap(): Promise<void> {
  await registerAuthRoutes(app);
  await registerBillingRoutes(app);
  await registerWebhookRoutes(app);
  await registerEntitlementRoutes(app);
  await registerPortalRoutes(app);
  await registerAskRoutes(app);

  await app.listen({ host: "0.0.0.0", port: config.PORT });
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
