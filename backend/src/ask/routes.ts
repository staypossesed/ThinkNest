import { FastifyInstance } from "fastify";
import { askQuestion } from "./orchestrator";
import { resolveEntitlement } from "../entitlements/service";
import { getUsageStatus } from "../usage/service";

export async function registerAskRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/ask",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const body = request.body as {
        question: string;
        maxAgents?: number;
        mode?: "fast" | "balanced" | "quality";
        useWebData?: boolean;
        forecastMode?: boolean;
        deepResearchMode?: boolean;
        preferredLocale?: "ru" | "en" | "zh";
        images?: string[];
        expertProfile?: string;
        memoryContext?: string;
      };

      const question = (body?.question ?? "").trim();
      if (!question) {
        return reply.code(400).send({ error: "Question is required." });
      }

      const entitlement = await resolveEntitlement(request.user!.id);
      const usage = await getUsageStatus(request.user!.id, entitlement);

      if (usage.remaining <= 0) {
        return reply.code(429).send({
          error: "Limit exceeded. Upgrade to Pro.",
          entitlements: {
            ...entitlement,
            usedQuestions: usage.used,
            remainingQuestions: usage.remaining
          }
        });
      }

      try {
        const response = await askQuestion({
          question,
          maxAgents: body.maxAgents ?? entitlement.maxAgents,
          mode: body.mode ?? "balanced",
          useWebData: body.useWebData && (entitlement.allowWebData !== false),
          forecastMode: body.forecastMode && (entitlement.allowForecast !== false),
          deepResearchMode: body.deepResearchMode,
          preferredLocale: body.preferredLocale,
          images: body.images,
          expertProfile: entitlement.allowExpertProfile !== false ? body.expertProfile : undefined,
          memoryContext: entitlement.allowMemory !== false ? body.memoryContext : undefined
        });

        return response;
      } catch (err) {
        app.log.error(err);
        const msg = err instanceof Error ? err.message : "Ask failed";
        return reply.code(500).send({ error: msg });
      }
    }
  );
}
