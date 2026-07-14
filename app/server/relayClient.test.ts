// 这个文件验证 OpenAI 兼容中转站响应解析，避免流式格式变化时直接影响业务。
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractDeltaContent, extractMessageContent, normalizeBaseUrl, RelayError, requestChatCompletion } from "./relayClient";

const prompt = { system: "system", user: "user" };
const config = {
  baseUrl: "https://relay.example.com",
  apiKey: "test-key",
  model: "gpt-5.5",
  timeoutMs: 1000,
  retryCount: 1,
  retryBaseDelayMs: 0,
};

function jsonCompletion(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function streamCompletion(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

function brokenStreamAfterFirstDelta(): Response {
  const encoder = new TextEncoder();
  let reads = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        if (reads === 1) {
          controller.enqueue(encoder.encode("data: {\"choices\":[{\"delta\":{\"content\":\"开\"}}]}\n\n"));
          return;
        }
        controller.error(new Error("stream dropped"));
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    },
  );
}

describe("requestChatCompletion", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries transient upstream status before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary bad gateway", { status: 502 }))
      .mockResolvedValueOnce(jsonCompletion("{\"ok\":true}"));
    vi.stubGlobal("fetch", fetchMock);

    const content = await requestChatCompletion(prompt, config);

    expect(content).toBe("{\"ok\":true}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable upstream status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestChatCompletion(prompt, config)).rejects.toMatchObject({
      code: "upstream_status",
      status: 400,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies request timeout errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = requestChatCompletion(prompt, { ...config, timeoutMs: 25, retryCount: 0 }).catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(25);

    const error = await promise;
    expect(error).toMatchObject({
      code: "timeout",
      retryable: true,
    });
    expect(error).toBeInstanceOf(RelayError);
  });

  it("does not retry after a stream has emitted delta content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(brokenStreamAfterFirstDelta())
      .mockResolvedValueOnce(jsonCompletion("{\"ok\":true}"));
    const onDelta = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestChatCompletion(prompt, { ...config, retryCount: 1 }, onDelta)).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith("开");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("relayClient", () => {
  it("normalizes relay base url without trailing slash", () => {
    expect(normalizeBaseUrl("https://sub2.congmingai.com/")).toBe("https://sub2.congmingai.com");
  });

  it("extracts content from non-stream chat completion", () => {
    const content = extractMessageContent({
      choices: [
        {
          message: {
            content: "{\"ok\":true}",
          },
        },
      ],
    });

    expect(content).toBe("{\"ok\":true}");
  });

  it("extracts delta content from stream chunk", () => {
    const content = extractDeltaContent({
      choices: [
        {
          delta: {
            content: "片段",
          },
        },
      ],
    });

    expect(content).toBe("片段");
  });

  it("reads text/event-stream chat completion chunks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamCompletion([
        "data: {\"choices\":[{\"delta\":{\"content\":\"脑\"}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"content\":\"洞\"}}]}\n\n",
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestChatCompletion(prompt, config)).resolves.toBe("脑洞");
  });
});
