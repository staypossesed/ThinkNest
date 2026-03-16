import { FastifyInstance } from "fastify";
import { askQuestion } from "./orchestrator";
import { resolveEntitlement } from "../entitlements/service";
import { getMultiAnswerUsageStatus } from "../usage/service";

function writeNdjson(res: NodeJS.WritableStream, obj: object): void {
  res.write(JSON.stringify(obj) + "\n");
}

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
        chatHistory?: Array<{ question: string; answer: string }>;
      };

      const question = (body?.question ?? "").trim();
      if (!question) {
        return reply.code(400).send({ error: "Question is required." });
      }

      const entitlement = await resolveEntitlement(request.user!.id);
      const deepResearchMode = !!body.deepResearchMode;
      if (deepResearchMode) {
        const usage = await getMultiAnswerUsageStatus(request.user!.id, entitlement);
        if (usage.remaining <= 0) {
          return reply.code(429).send({
            error: "Лимит мульти-ответов исчерпан (100/неделю). Попробуйте позже.",
            entitlements: {
              ...entitlement,
              usedQuestions: usage.used,
              remainingQuestions: usage.remaining,
              usedMultiAnswer: usage.used,
              remainingMultiAnswer: usage.remaining
            }
          });
        }
      }

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no"
      });
      (res as NodeJS.WritableStream & { socket?: { setNoDelay?: (v: boolean) => void } }).socket?.setNoDelay?.(true);

      const onAnswer = (answer: { id: string; title: string; content: string; model: string; durationMs: number }) => {
        writeNdjson(res, { type: "answer", answer });
      };
      const onToken = (agentId: string, token: string) => {
        writeNdjson(res, { type: "token", agentId, token });
      };

      try {
        const response = await askQuestion(
          {
            question,
            maxAgents: body.maxAgents ?? entitlement.maxAgents,
            mode: body.mode ?? "balanced",
            useWebData: body.useWebData && (entitlement.allowWebData !== false),
            forecastMode: body.forecastMode && (entitlement.allowForecast !== false),
            deepResearchMode: body.deepResearchMode,
            preferredLocale: body.preferredLocale,
            images: body.images,
            expertProfile: entitlement.allowExpertProfile !== false ? body.expertProfile : undefined,
            memoryContext: entitlement.allowMemory !== false ? body.memoryContext : undefined,
            chatHistory: body.chatHistory
          },
          onAnswer,
          onToken
        );
        writeNdjson(res, { type: "done", response });
      } catch (err) {
        app.log.error(err);
        const msg = err instanceof Error ? err.message : "Ask failed";
        writeNdjson(res, { type: "error", error: msg });
      } finally {
        res.end();
      }
    }
  );
}
