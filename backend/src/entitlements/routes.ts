import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveEntitlement } from "./service";
import { consumeUsage, getUsageStatus } from "../usage/service";

export async function registerEntitlementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/entitlements", { preHandler: [app.authenticate] }, async (request) => {
    const entitlement = await resolveEntitlement(request.user!.id);
    const usage = await getUsageStatus(request.user!.id, entitlement);
    return {
      ...entitlement,
      usedQuestions: usage.used,
      remainingQuestions: usage.remaining
    };
  });

  app.post("/usage/can-ask", { preHandler: [app.authenticate] }, async (request) => {
    const entitlement = await resolveEntitlement(request.user!.id);
    const usage = await getUsageStatus(request.user!.id, entitlement);

    return {
      allowed: usage.remaining > 0,
      reason: usage.remaining > 0 ? null : "Лимит запросов исчерпан для текущего плана.",
      entitlements: {
        ...entitlement,
        usedQuestions: usage.used,
        remainingQuestions: usage.remaining
      }
    };
  });

  app.post("/usage/consume", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = z.object({ question: z.string().min(1) }).parse(request.body);
    const entitlement = await resolveEntitlement(request.user!.id);
    const status = await getUsageStatus(request.user!.id, entitlement);
    if (status.remaining <= 0) {
      return reply.code(429).send({
        ok: false,
        reason: "Лимит запросов исчерпан для текущего плана.",
        entitlements: {
          ...entitlement,
          usedQuestions: status.used,
          remainingQuestions: status.remaining
        }
      });
    }
    const usage = await consumeUsage(request.user!.id, entitlement, body.question);

    return {
      ok: true,
      entitlements: {
        ...entitlement,
        usedQuestions: usage.used,
        remainingQuestions: usage.remaining
      }
    };
  });
}
