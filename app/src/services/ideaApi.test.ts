// 这个文件验证前端 AI 服务层能读取本地代理流式结果，并把 AI 错误真实暴露给调用方。
import { describe, expect, it, vi } from "vitest";
import { branchFromDiscussion, expandMindNode, generateIdeas, generateMindMap, generateWords, mixIdeas, recommendCollision, refineIdea, requestChallenge, requestDiscussion, respondToDiscussion, rerollMindMap, transformIdea } from "./ideaApi";
import type { BrainstormMap, IdeaDiscussion } from "../types/idea";

function jsonEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe("ideaApi", () => {
  it("reads dimension groups from the streaming local API", async () => {
    const progress: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('event: delta\ndata: 正在生成维度词\n\nevent: done\ndata: {"groups":[{"type":"人群","label":"人群","description":"谁会使用","words":[{"id":"w1","text":"独立开发者","groupType":"人群","locked":false,"selected":true,"source":"AI"}]}]}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const groups = await generateWords({ topic: "开发者工具", intensity: "正常", onProgress: (text) => progress.push(text) });

    expect(groups[0]?.words[0]?.source).toBe("AI");
    expect(progress.join("")).toContain("正在生成维度词");
    vi.unstubAllGlobals();
  });

  it("rejects words generation when the local API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));

    await expect(generateWords({ topic: "我没有项目灵感", intensity: "正常" })).rejects.toThrow("network failed");
    vi.unstubAllGlobals();
  });

  it("passes abort signals through to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(jsonEvent("done", { groups: [] }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateWords({ topic: "开发者工具", intensity: "正常", signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/words",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
    vi.unstubAllGlobals();
  });

  it("preserves whitespace and newlines in JSON encoded delta events", async () => {
    const progress: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`${jsonEvent("delta", "  第一行\n第二行  ")}${jsonEvent("done", { groups: [] })}`, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    await generateWords({ topic: "开发者工具", intensity: "正常", onProgress: (text) => progress.push(text) });

    expect(progress).toEqual(["  第一行\n第二行  "]);
    vi.unstubAllGlobals();
  });

  it("surfaces JSON error bodies from non-stream responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "AI key 未配置" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(generateWords({ topic: "开发者工具", intensity: "正常" })).rejects.toThrow("AI key 未配置");
    vi.unstubAllGlobals();
  });

  it("reads a brainstorm map from the streaming local API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          'event: done\ndata: {"map":{"id":"map-1","topic":"开发者工具","stuckType":"有技术没需求","center":{"id":"center","label":"开发者工具","category":"中心","level":0,"x":50,"y":50,"selectable":false,"locked":false,"selected":false,"reason":"原始主题"},"nodes":[{"id":"center","label":"开发者工具","category":"中心","level":0,"x":50,"y":50,"selectable":false,"locked":false,"selected":false,"reason":"原始主题"},{"id":"n1","label":"独立开发者","category":"人群","level":1,"x":20,"y":20,"selectable":true,"locked":false,"selected":true,"reason":"谁可能需要"}],"edges":[{"id":"e1","from":"center","to":"n1","label":"人群"}],"recommendedNodeIds":["n1"]}}\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      ),
    );

    const map = await generateMindMap({ topic: "开发者工具", intensity: "正常" });

    expect(map.nodes[1]?.label).toBe("独立开发者");
    expect(map.recommendedNodeIds).toContain("n1");
    vi.unstubAllGlobals();
  });

  it("requests node expansion from the streaming local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        'event: delta\ndata: 正在继续发散\n\nevent: done\ndata: {"expansion":{"nodes":[{"id":"expand-1","label":"撤销按钮","category":"物件","level":2,"x":64,"y":42,"selectable":true,"locked":false,"selected":false,"reason":"从情绪找载体","parentId":"node-emotion"}],"edges":[{"id":"edge-expand-1","from":"node-emotion","to":"expand-1","label":"找载体"}],"recommendedNodeIds":["expand-1"]}}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const center = {
      id: "center",
      label: "游戏机制产品",
      category: "中心",
      level: 0,
      x: 50,
      y: 50,
      selectable: false,
      locked: true,
      selected: false,
      reason: "中心主题",
    } as const;
    const node = {
      id: "node-emotion",
      label: "不服再来",
      category: "情绪",
      level: 1,
      x: 60,
      y: 40,
      selectable: true,
      locked: false,
      selected: true,
      reason: "核心情绪",
      parentId: center.id,
    } as const;
    const progress: string[] = [];

    const expansion = await expandMindNode({
      topic: "游戏机制产品",
      intensity: "正常",
      map: {
        id: "map",
        topic: "游戏机制产品",
        stuckType: "有兴趣没形态",
        center,
        nodes: [center, node],
        edges: [{ id: "edge", from: center.id, to: node.id, label: "情绪" }],
        recommendedNodeIds: [node.id],
        createdAt: "2026-07-09T00:00:00.000Z",
      },
      nodeId: node.id,
      onProgress: (text) => progress.push(text),
    });

    expect(expansion.nodes[0]?.label).toBe("撤销按钮");
    expect(progress.join("")).toContain("正在继续发散");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/map/expand",
      expect.objectContaining({
        body: expect.stringContaining("\"nodeId\":\"node-emotion\""),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("requests mind map reroll from the streaming local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        'event: done\ndata: {"map":{"id":"map","topic":"开发者工具","stuckType":"有技术没需求","center":{"id":"center","label":"开发者工具","category":"中心","level":0,"x":50,"y":50,"selectable":false,"locked":true,"selected":false,"reason":"中心主题"},"nodes":[{"id":"center","label":"开发者工具","category":"中心","level":0,"x":50,"y":50,"selectable":false,"locked":true,"selected":false,"reason":"中心主题"},{"id":"node-scene","label":"发布前一小时","category":"场景","level":1,"x":30,"y":40,"selectable":true,"locked":false,"selected":true,"reason":"换到更紧张的场景"}],"edges":[{"id":"edge","from":"center","to":"node-scene","label":"场景"}],"recommendedNodeIds":["node-scene"],"createdAt":"2026-07-09T00:00:00.000Z"}}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const center = {
      id: "center",
      label: "开发者工具",
      category: "中心",
      level: 0,
      x: 50,
      y: 50,
      selectable: false,
      locked: true,
      selected: false,
      reason: "中心主题",
    } as const;
    const node = {
      id: "node-scene",
      label: "深夜",
      category: "场景",
      level: 1,
      x: 30,
      y: 40,
      selectable: true,
      locked: false,
      selected: true,
      reason: "原始场景",
      parentId: center.id,
    } as const;

    const map = await rerollMindMap({
      topic: "开发者工具",
      intensity: "正常",
      map: {
        id: "map",
        topic: "开发者工具",
        stuckType: "有技术没需求",
        center,
        nodes: [center, node],
        edges: [{ id: "edge", from: center.id, to: node.id, label: "场景" }],
        recommendedNodeIds: [node.id],
        createdAt: "2026-07-09T00:00:00.000Z",
      },
    });

    expect(map.nodes[1]?.label).toBe("发布前一小时");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/map/reroll",
      expect.objectContaining({
        body: expect.stringContaining("\"map\""),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("requests AI collision recommendation from existing groups", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('event: delta\ndata: 正在挑选碰撞词\n\nevent: done\ndata: {"recommendation":{"selectedWordIds":["crowd-b","scene-a"],"reason":"有张力"}}\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const progress: string[] = [];

    const recommendation = await recommendCollision({
      topic: "开发者工具",
      groups: [
        {
          type: "人群",
          label: "人群",
          description: "谁会用",
          words: [
            { id: "crowd-a", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "AI" },
            { id: "crowd-b", text: "产品经理", groupType: "人群", locked: false, selected: false, source: "AI" },
          ],
        },
        {
          type: "场景",
          label: "场景",
          description: "什么时候",
          words: [{ id: "scene-a", text: "深夜", groupType: "场景", locked: false, selected: true, source: "AI" }],
        },
      ],
      onProgress: (text) => progress.push(text),
    });

    expect(recommendation.selectedWordIds).toEqual(["crowd-b", "scene-a"]);
    expect(progress.join("")).toContain("正在挑选碰撞词");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/collision",
      expect.objectContaining({
        body: expect.stringContaining("\"groups\""),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("rejects mind map generation when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));

    await expect(generateMindMap({ topic: "我不知道做什么", intensity: "轻微" })).rejects.toThrow("network failed");
    vi.unstubAllGlobals();
  });

  it("rejects idea generation when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const sourceWords = [
      { id: "1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" },
      { id: "2", text: "深夜", groupType: "场景", locked: false, selected: true, source: "test" },
      { id: "3", text: "烂尾焦虑", groupType: "情绪", locked: false, selected: true, source: "test" },
      { id: "4", text: "GitHub 仓库", groupType: "物件", locked: false, selected: true, source: "test" },
      { id: "5", text: "博物馆", groupType: "结构", locked: false, selected: true, source: "test" },
      { id: "6", text: "每天只能 1 分钟", groupType: "限制", locked: false, selected: true, source: "test" },
    ] as const;

    await expect(generateIdeas({ topic: "开发者工具", sourceWords: [...sourceWords] })).rejects.toThrow("network failed");
    vi.unstubAllGlobals();
  });

  it("生成脑洞时把可选碰撞配方放进请求体", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(jsonEvent("done", { ideas: [] }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateIdeas({
      topic: "开发者工具",
      sourceWords: [{ id: "word-1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" }],
      collisionRecipe: "add-constraint",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/ideas",
      expect.objectContaining({
        body: expect.stringContaining('"collisionRecipe":"add-constraint"'),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("未选择碰撞配方时保持原请求体", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(jsonEvent("done", { ideas: [] }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateIdeas({
      topic: "开发者工具",
      sourceWords: [{ id: "word-1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" }],
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(requestBody).toEqual({
      topic: "开发者工具",
      sourceWords: [{ id: "word-1", text: "独立开发者", groupType: "人群", locked: false, selected: true, source: "test" }],
    });
    vi.unstubAllGlobals();
  });

  it("rejects idea transform when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failed")));
    const idea = {
      id: "idea",
      title: "项目遗迹馆",
      summary: "扫描废弃项目并生成展签。",
      whyInteresting: "它把失败经验变成可浏览资产。",
      firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
      sourceWords: [],
      createdAt: "2026-07-07T00:00:00.000Z",
    };

    await expect(transformIdea({ idea, direction: "只保留核心隐喻" })).rejects.toThrow("network failed");
    vi.unstubAllGlobals();
  });

  it("reads an idea refinement from the streaming local API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          'event: delta\ndata: 正在炼化\n\nevent: done\ndata: {"refinement":{"id":"refine-1","ideaId":"idea","vitality":{"targetUser":"独立开发者","triggerScene":"周日晚上","coreEmotion":"烂尾焦虑","existingAlternative":"归档仓库","smallestPlayableVersion":"生成一张展签"},"roundtable":[{"role":"懒人用户","feedback":"粘贴链接就要能看。"},{"role":"毒舌用户","feedback":"别只复述 README。"},{"role":"产品经理","feedback":"把烂尾变成资产。"},{"role":"工程师","feedback":"先只读公开仓库。"},{"role":"测试","feedback":"覆盖空仓库。"},{"role":"商人","feedback":"作品集场景有付费点。"}],"directions":[{"type":"玩具版","title":"仓库墓志铭","description":"生成荒诞展签。","firstStep":"手动输入项目名。"},{"type":"工具版","title":"烂尾复盘器","description":"整理失败经验。","firstStep":"读取 README。"},{"type":"产品版","title":"项目作品集博物馆","description":"生成可分享作品页。","firstStep":"做公开分享页。"}],"mvpLadder":[{"horizon":"1小时 MVP","goal":"验证有趣","build":"表单生成卡","proof":"用户截图"},{"horizon":"1天 MVP","goal":"验证仓库输入","build":"读取 README","proof":"卡片不重复"},{"horizon":"一周版本","goal":"验证分享","build":"分享页","proof":"有人发出去"}],"actions":[{"type":"继续发散","label":"继续发散","description":"回到导图。"},{"type":"收束推进","label":"收束推进","description":"拆 MVP。"},{"type":"放入孵化箱","label":"放入孵化箱","description":"先收藏。"}],"createdAt":"2026-07-08T00:00:00.000Z"}}\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      ),
    );
    const idea = {
      id: "idea",
      title: "项目遗迹馆",
      summary: "扫描废弃项目并生成展签。",
      whyInteresting: "它把失败经验变成可浏览资产。",
      firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
      sourceWords: [],
      createdAt: "2026-07-07T00:00:00.000Z",
    };
    const progress: string[] = [];

    const refinement = await refineIdea({ idea, onProgress: (text) => progress.push(text) });

    expect(refinement.ideaId).toBe("idea");
    expect(refinement.roundtable).toHaveLength(6);
    expect(refinement.directions.map((direction) => direction.type)).toEqual(["玩具版", "工具版", "产品版"]);
    expect(progress.join("")).toContain("正在炼化");
    vi.unstubAllGlobals();
  });

  it("从 challenge SSE 接口读取指定角色的严格挑战结果", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        'event: delta\ndata: 正在唱反调\n\nevent: done\ndata: {"challenge":{"ideaId":"idea","role":"毒舌用户","challenge":"如果只是总结 README，我会立刻关掉。","risk":"用户看不到新价值。","newDirection":"改成只暴露项目失败模式。","createdAt":"2026-07-08T00:00:00.000Z"}}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const idea = {
      id: "idea",
      title: "项目遗迹馆",
      summary: "扫描废弃项目并生成展签。",
      whyInteresting: "它把失败经验变成可浏览资产。",
      firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
      sourceWords: [],
      createdAt: "2026-07-07T00:00:00.000Z",
    };
    const progress: string[] = [];

    const challenge = await requestChallenge({ idea, role: "毒舌用户", onProgress: (text) => progress.push(text) });

    expect(challenge.role).toBe("毒舌用户");
    expect(challenge.ideaId).toBe(idea.id);
    expect(progress.join("")).toContain("正在唱反调");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/challenge",
      expect.objectContaining({ body: JSON.stringify({ idea, role: "毒舌用户" }) }),
    );
    vi.unstubAllGlobals();
  });

  it("从 discussion SSE 接口读取三轮结构化讨论", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        'event: delta\ndata: 正在召集编辑部\n\nevent: done\ndata: {"discussion":{"id":"discussion-1","ideaId":"idea","createdAt":"2026-07-08T00:00:00.000Z","status":"completed","participants":["用户代言人","反常识派","跨界连接者","现实构建者"],"rounds":[],"synthesis":{"conservativeDirection":{"title":"轻量版","description":"先做小实验","nextStep":"访谈三人"},"radicalDirection":{"title":"激进版","description":"改变入口","nextStep":"做原型"},"unexpectedDirection":{"title":"意外版","description":"借用仪式","nextStep":"画流程"}},"collectedSparkIds":[]}}\n\n',
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const idea = { id: "idea", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const progress: string[] = [];
    const discussion = await requestDiscussion({ idea, onProgress: (text) => progress.push(text) });

    expect(discussion.id).toBe("discussion-1");
    expect(discussion.ideaId).toBe(idea.id);
    expect(progress.join("")).toContain("召集");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/idea/discussion",
      expect.objectContaining({ body: JSON.stringify({ idea }) }),
    );
    vi.unstubAllGlobals();
  });

  it("向指定角色发送一次有限介入并保留来源观点", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(jsonEvent("done", {
      intervention: {
        id: "intervention-1",
        type: "question",
        prompt: "如果用户不愿公开失败呢？",
        targetRole: "用户代言人",
        sourceRole: "反常识派",
        sourceClaim: "失败比成功更有戏剧性",
        responses: [{ role: "用户代言人", claim: "先从私密复盘开始", tension: "传播性会降低" }],
        createdAt: "2026-07-14T00:00:00.000Z",
      },
    }), { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const idea = { id: "idea", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const discussion = { id: "discussion-1", ideaId: idea.id, createdAt: "2026-07-13T00:00:00.000Z", status: "completed", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"], rounds: [], collectedSparkIds: [], interventions: [] } as IdeaDiscussion;

    const result = await respondToDiscussion({
      idea,
      discussion,
      type: "question",
      prompt: "如果用户不愿公开失败呢？",
      targetRole: "用户代言人",
      sourceRole: "反常识派",
      sourceClaim: "失败比成功更有戏剧性",
    });

    expect(result.responses[0]?.role).toBe("用户代言人");
    expect(fetchMock).toHaveBeenCalledWith("/api/idea/discussion/respond", expect.objectContaining({
      body: JSON.stringify({ idea, discussion, type: "question", prompt: "如果用户不愿公开失败呢？", targetRole: "用户代言人", sourceRole: "反常识派", sourceClaim: "失败比成功更有戏剧性" }),
    }));
    vi.unstubAllGlobals();
  });

  it("从讨论收束方向请求一个新导图分支", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(jsonEvent("done", { expansion: { nodes: [], edges: [], recommendedNodeIds: [] } }), { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const center = { id: "center", label: "项目灵感", category: "中心", level: 0, x: 50, y: 50, selectable: false, locked: true, selected: false, reason: "中心主题" } as const;
    const map = { id: "map", topic: "项目灵感", stuckType: "有兴趣没形态", center, nodes: [center], edges: [], recommendedNodeIds: [], createdAt: "2026-07-13T00:00:00.000Z" } as unknown as BrainstormMap;
    const idea = { id: "idea", title: "项目遗迹馆", summary: "扫描废弃项目", whyInteresting: "把失败变成资产", firstVersion: "先做扫描", sourceWords: [], createdAt: "2026-07-07T00:00:00.000Z" };
    const discussion = { id: "discussion-1", ideaId: idea.id, createdAt: "2026-07-13T00:00:00.000Z", status: "completed", participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"], rounds: [], synthesis: { conservativeDirection: { title: "轻量版", description: "私密复盘", nextStep: "先做表单" }, radicalDirection: { title: "激进版", description: "公开展览", nextStep: "做展厅" }, unexpectedDirection: { title: "意外版", description: "考古仪式", nextStep: "画流程" } }, collectedSparkIds: [], interventions: [] } as unknown as IdeaDiscussion;

    await branchFromDiscussion({ idea, discussion, directionKey: "unexpectedDirection", map, parentNodeId: center.id });

    expect(fetchMock).toHaveBeenCalledWith("/api/idea/discussion/branch", expect.objectContaining({
      body: JSON.stringify({ idea, discussion, directionKey: "unexpectedDirection", map, parentNodeId: center.id }),
    }));
    vi.unstubAllGlobals();
  });

  it("reads a mixed idea seed from the streaming local API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          'event: delta\ndata: 正在混合\n\nevent: done\ndata: {"seed":{"mixedTopic":"失败作品集博物馆","theme":"把旧项目的失败经验变成可以展示的资产","tension":"羞耻感和炫耀欲之间的拉扯","startingPrompt":"给独立开发者做一个能把烂尾仓库生成作品集展签的工具。","sourceIdeaTitles":["项目遗迹馆","灵感潮汐钟"],"createdAt":"2026-07-08T00:00:00.000Z"}}\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      ),
    );
    const ideas = [
      {
        id: "idea-1",
        title: "项目遗迹馆",
        summary: "扫描废弃项目并生成展签。",
        whyInteresting: "它把失败经验变成可浏览资产。",
        firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
        sourceWords: [],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
      {
        id: "idea-2",
        title: "灵感潮汐钟",
        summary: "把一天中的注意力波动变成创意窗口。",
        whyInteresting: "它让创意节奏有了可感知形状。",
        firstVersion: "先做手动记录和提醒。",
        sourceWords: [],
        createdAt: "2026-07-07T00:00:00.000Z",
      },
    ];
    const progress: string[] = [];

    const seed = await mixIdeas({ ideas, onProgress: (text) => progress.push(text) });

    expect(seed.mixedTopic).toBe("失败作品集博物馆");
    expect(seed.sourceIdeaTitles).toEqual(["项目遗迹馆", "灵感潮汐钟"]);
    expect(progress.join("")).toContain("正在混合");
    vi.unstubAllGlobals();
  });
});
