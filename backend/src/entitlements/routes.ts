import { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveEntitlement } from "./service";
import { consumeUsage, getMultiAnswerUsageStatus } from "../usage/service";

export async function registerEntitlementRoutes(app: FastifyInstance): Promise<void> {
  app.get("/entitlements", { preHandler: [app.authenticate] }, async (request) => {
    const entitlement = await resolveEntitlement(request.user!.id);
    const usage = await getMultiAnswerUsageStatus(request.user!.id, entitlement);
    return {
      ...entitlement,
      usedQuestions: usage.used,
      remainingQuestions: usage.remaining,
      usedMultiAnswer: usage.used,
      remainingMultiAnswer: usage.remaining
    };
  });

  app.post("/usage/can-ask", { preHandler: [app.authenticate] }, async (request) => {
    const body = (request.body as { deepResearchMode?: boolean }) ?? {};
    const entitlement = await resolveEntitlement(request.user!.id);
    if (!body.deepResearchMode) {
      const usage = await getMultiAnswerUsageStatus(request.user!.id, entitlement);
      return {
        allowed: true,
        reason: null,
        entitlements: {
          ...entitlement,
          usedQuestions: usage.used,
          remainingQuestions: usage.remaining,
          usedMultiAnswer: usage.used,
          remainingMultiAnswer: usage.remaining
        }
      };
    }
    const usage = await getMultiAnswerUsageStatus(request.user!.id, entitlement);
    const allowed = usage.remaining >= 1;
    return {
      allowed,
      reason: allowed ? null : "Лимит мульти-ответов исчерпан (100/неделю). Попробуйте позже.",
      entitlements: {
        ...entitlement,
        usedQuestions: usage.used,
        remainingQuestions: usage.remaining,
        usedMultiAnswer: usage.used,
        remainingMultiAnswer: usage.remaining
      }
    };
  });

  app.post("/usage/consume", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = z.object({ question: z.string().min(1), count: z.number().int().min(1).max(10).optional() }).parse(request.body);
    const count = body.count ?? 1;
    const entitlement = await resolveEntitlement(request.user!.id);
    const status = await getMultiAnswerUsageStatus(request.user!.id, entitlement);
    if (count > 1 && status.remaining < 1) {
      return reply.code(429).send({
        ok: false,
        reason: "Лимит мульти-ответов исчерпан (100/неделю). Попробуйте позже.",
        entitlements: {
          ...entitlement,
          usedQuestions: status.used,
          remainingQuestions: status.remaining,
          usedMultiAnswer: status.used,
          remainingMultiAnswer: status.remaining
        }
      });
    }
    const usage = await consumeUsage(request.user!.id, entitlement, body.question, count);

    return {
      ok: true,
      entitlements: {
        ...entitlement,
        usedQuestions: usage.used,
        remainingQuestions: usage.remaining,
        usedMultiAnswer: usage.used,
        remainingMultiAnswer: usage.remaining
      }
    };
  });
}
