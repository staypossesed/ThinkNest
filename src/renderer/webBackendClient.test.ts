import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock browser globals before importing webBackendClient
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
vi.stubGlobal("localStorage", {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn()
});
vi.stubGlobal("window", { location: { hostname: "localhost" } });

// Import after mocks
const { webAsk, webCheckBackend } = await import("./webBackendClient");

describe("webBackendClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue("fake-token");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("webAsk", () => {
    it("returns response on success", async () => {
      const mockResponse: import("../shared/types").AskResponse = {
        answers: [
          { id: "planner", title: "P", content: "c1", model: "m1", durationMs: 100 },
          { id: "explainer", title: "E", content: "c2", model: "m2", durationMs: 50 }
        ],
        final: { content: "final", model: "m1", durationMs: 150 },
        webSources: null
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
        json: () => Promise.resolve(mockResponse)
      });

      const onAnswer = vi.fn();
      const res = await webAsk({ question: "test" }, onAnswer);

      expect(res.answers).toHaveLength(2);
      expect(res.final.content).toBe("final");
      expect(onAnswer).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries on 500", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error")
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
          json: () =>
            Promise.resolve({
              answers: [{ id: "explainer", title: "E", content: "ok", model: "m", durationMs: 0 }],
              final: { content: "ok", model: "m", durationMs: 0 },
              webSources: null
            })
        });

      const res = await webAsk({ question: "test" });
      expect(res.final.content).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("retries on Failed to fetch (network error)", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Failed to fetch"))
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: (k: string) => (k === "content-type" ? "application/json" : null) },
          json: () =>
            Promise.resolve({
              answers: [],
              final: { content: "ok", model: "m", durationMs: 0 },
              webSources: null
            })
        });

      const res = await webAsk({ question: "test" });
      expect(res.final.content).toBe("ok");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized")
      });

      await expect(webAsk({ question: "test" })).rejects.toThrow(/401|Unauthorized/);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 400", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request")
      });

      await expect(webAsk({ question: "test" })).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("webCheckBackend", () => {
    it("returns true when /health returns ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      });
      const ok = await webCheckBackend();
      expect(ok).toBe(true);
    });

    it("returns true when /health returns service field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ service: "thinknest" })
      });
      const ok = await webCheckBackend();
      expect(ok).toBe(true);
    });

    it("returns false when /health returns 404", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      const ok = await webCheckBackend();
      expect(ok).toBe(false);
    });
  });
});
