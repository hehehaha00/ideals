// 这个文件用浏览器验证默认轻量路径和按需深入的 MVP 脑洞流程。
import { expect, test, type Page, type Route } from "@playwright/test";

const dimensionTypes = ["人群", "场景", "情绪", "物件", "结构", "限制"] as const;
type JsonRecord = Record<string, unknown>;

interface MockRequests {
  map: JsonRecord[];
  expand: JsonRecord[];
  words: JsonRecord[];
  collision: JsonRecord[];
  ideas: JsonRecord[];
  transform: JsonRecord[];
  refine: JsonRecord[];
  challenge: JsonRecord[];
  discussion: JsonRecord[];
  discussionResponse: JsonRecord[];
  discussionBranch: JsonRecord[];
  mix: JsonRecord[];
}

function streamPayload(data: unknown): string {
  return `event: done\ndata: ${JSON.stringify(data)}\n\n`;
}

// 将 Playwright 请求体收窄为可安全读取的 JSON 对象。
function asRecord(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

// 读取 mock 请求中的字符串字段，保持请求体类型安全。
function readString(record: JsonRecord, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

// 将请求体里的对象数组收窄，供混合想法等断言复用。
function readRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

// 安装一组稳定的 SSE mock，并记录关键请求供流程断言。
async function installIdeaApiMocks(page: Page): Promise<MockRequests> {
  const requests: MockRequests = {
    map: [],
    expand: [],
    words: [],
    collision: [],
    ideas: [],
    transform: [],
    refine: [],
    challenge: [],
    discussion: [],
    discussionResponse: [],
    discussionBranch: [],
    mix: [],
  };

  await page.route("**/api/idea/**", async (route: Route) => {
    const url = route.request().url();
    const rawBody: unknown = route.request().postDataJSON();
    const body = asRecord(rawBody);
    const fulfill = (data: unknown): Promise<void> => route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: streamPayload(data),
    });

    if (url.endsWith("/map")) {
      requests.map.push(body);
      const mapIndex = requests.map.length - 1;
      const topic = readString(body, "topic", "未命名主题");
      const center = {
        id: mapIndex === 0 ? "center" : `center-${mapIndex}`,
        label: topic,
        category: "中心",
        level: 0,
        x: 50,
        y: 50,
        selectable: false,
        locked: true,
        selected: false,
        reason: "中心主题",
      };
      const nodes = dimensionTypes.map((category, index) => ({
        id: `node-${mapIndex}-${category}`,
        label: `${category}节点`,
        category,
        level: 1,
        x: 20 + index * 10,
        y: 25 + index * 8,
        selectable: true,
        locked: false,
        selected: false,
        reason: `${category}角度`,
        parentId: center.id,
      }));
      await fulfill({
        map: {
          id: mapIndex === 0 ? "map" : `map-${mapIndex}`,
          topic,
          stuckType: "有技术没需求",
          center,
          nodes: [center, ...nodes],
          edges: nodes.map((node) => ({ id: `edge-${node.id}`, from: center.id, to: node.id, label: node.category })),
          recommendedNodeIds: nodes.map((node) => node.id),
          createdAt: "2026-07-08T00:00:00.000Z",
        },
      });
      return;
    }

    if (url.endsWith("/map/expand")) {
      requests.expand.push(body);
      const parentId = readString(body, "nodeId", "center");
      await fulfill({
        expansion: {
          nodes: [
            {
              id: "expand-object",
              label: "撤销按钮",
              category: "物件",
              level: 2,
              x: 62,
              y: 44,
              selectable: true,
              locked: false,
              selected: false,
              reason: "从当前节点继续找一个可操作载体。",
              parentId,
              source: "找载体",
            },
            {
              id: "expand-crowd",
              label: "爱反悔的玩家",
              category: "人群",
              level: 2,
              x: 68,
              y: 48,
              selectable: true,
              locked: false,
              selected: false,
              reason: "从当前节点换到更极端的人群。",
              parentId,
              source: "换人群",
            },
          ],
          edges: [
            { id: "edge-expand-object", from: parentId, to: "expand-object", label: "找载体" },
            { id: "edge-expand-crowd", from: parentId, to: "expand-crowd", label: "换人群" },
          ],
          recommendedNodeIds: ["expand-object", "expand-crowd"],
        },
      });
      return;
    }

    if (url.endsWith("/words")) {
      requests.words.push(body);
      await fulfill({
        groups: dimensionTypes.map((type) => ({
          type,
          label: type,
          description: type,
          words: [
            { id: `word-${type}`, text: `${type}词`, groupType: type, locked: false, selected: true, source: "AI" },
            { id: `word-${type}-alt`, text: `${type}备选`, groupType: type, locked: false, selected: false, source: "AI" },
          ],
        })),
      });
      return;
    }

    if (url.endsWith("/collision")) {
      requests.collision.push(body);
      await fulfill({
        recommendation: {
          selectedWordIds: dimensionTypes.map((type) => `word-${type}-alt`),
          reason: "AI 选择备选词制造更强碰撞。",
        },
      });
      return;
    }

    if (url.endsWith("/ideas")) {
      requests.ideas.push(body);
      const sourceWords = readRecords(body.sourceWords);
      await fulfill({
        ideas: ["项目遗迹馆", "烂尾复盘器", "仓库墓志铭"].map((title, index) => ({
          id: `idea-${index}`,
          title,
          summary: "扫描废弃项目并生成展签。",
          whyInteresting: "它把失败经验变成可浏览资产。",
          firstVersion: "先做 GitHub 仓库扫描和卡片生成。",
          sourceWords,
          sourcePath: ["开发者工具", "烂尾焦虑", "项目遗迹"],
          createdAt: "2026-07-08T00:00:00.000Z",
        })),
      });
      return;
    }

    if (url.endsWith("/transform")) {
      requests.transform.push(body);
      const idea = asRecord(body.idea);
      const direction = readString(body, "direction", "换个角度");
      const ideaId = readString(idea, "id", "idea-0");
      await fulfill({
        idea: {
          ...idea,
          id: "idea-transform",
          parentId: ideaId,
          title: `${readString(idea, "title", "脑洞")} · ${direction}`,
          transformDirection: direction,
        },
      });
      return;
    }

    if (url.endsWith("/refine")) {
      requests.refine.push(body);
      const ideaId = readString(asRecord(body.idea), "id", "idea-transform");
      await fulfill({
        refinement: {
          id: "refine-1",
          ideaId,
          vitality: {
            targetUser: "独立开发者",
            triggerScene: "周日晚上",
            coreEmotion: "烂尾焦虑",
            existingAlternative: "归档仓库",
            smallestPlayableVersion: "生成一张展签",
          },
          roundtable: [
            { role: "懒人用户", feedback: "粘贴链接就要能看。" },
            { role: "毒舌用户", feedback: "别只复述 README。" },
            { role: "产品经理", feedback: "把烂尾变成资产。" },
            { role: "工程师", feedback: "先只读公开仓库。" },
            { role: "测试", feedback: "覆盖空仓库。" },
            { role: "商人", feedback: "作品集场景有付费点。" },
          ],
          directions: [
            { type: "玩具版", title: "仓库墓志铭", description: "生成荒诞展签。", firstStep: "手动输入项目名。" },
            { type: "工具版", title: "烂尾复盘器", description: "整理失败经验。", firstStep: "读取 README。" },
            { type: "产品版", title: "项目作品集博物馆", description: "生成可分享作品页。", firstStep: "做公开分享页。" },
          ],
          mvpLadder: [
            { horizon: "1小时 MVP", goal: "验证有趣", build: "表单生成卡", proof: "用户截图" },
            { horizon: "1天 MVP", goal: "验证仓库输入", build: "读取 README", proof: "卡片不重复" },
            { horizon: "一周版本", goal: "验证分享", build: "分享页", proof: "有人发出去" },
          ],
          actions: [
            { type: "继续发散", label: "继续发散", description: "回到导图。" },
            { type: "收束推进", label: "收束推进", description: "拆 MVP。" },
            { type: "放入孵化箱", label: "放入孵化箱", description: "先收藏。" },
          ],
          createdAt: "2026-07-08T00:00:00.000Z",
        },
      });
      return;
    }

    if (url.endsWith("/challenge")) {
      requests.challenge.push(body);
      const role = readString(body, "role", "懒人用户");
      const ideaId = readString(asRecord(body.idea), "id", "idea-transform");
      await fulfill({
        challenge: {
          ideaId,
          role,
          challenge: "懒人用户只想一键完成，不会学习复杂流程。",
          risk: "用户可能没有耐心公开整理失败项目。",
          newDirection: "把入口压缩成一次粘贴，直接生成可分享展签。",
          createdAt: "2026-07-08T00:00:00.000Z",
        },
      });
      return;
    }

    if (url.endsWith("/discussion/respond")) {
      requests.discussionResponse.push(body);
      const role = readString(body, "targetRole", "用户代言人");
      await fulfill({
        intervention: {
          id: "intervention-1",
          type: readString(body, "type", "question"),
          prompt: readString(body, "prompt"),
          targetRole: role,
          sourceRole: readString(body, "sourceRole") || undefined,
          sourceClaim: readString(body, "sourceClaim") || undefined,
          responses: [
            {
              role,
              claim: "如果入口保持私密，用户会更愿意承认失败并继续整理。",
              tension: "公开表达欲与失败羞耻之间需要一个缓冲区。",
              spark: { id: "spark-response", text: "先生成只有自己能看到的失败展签" },
            },
          ],
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      });
      return;
    }

    if (url.endsWith("/discussion/branch")) {
      requests.discussionBranch.push(body);
      const map = asRecord(body.map);
      const mapNodes = readRecords(map.nodes);
      const parentId = readString(body, "parentNodeId", readString(mapNodes[0], "id", "center"));
      const branchNodes = [
        ["branch-ritual", "告别仪式", "场景"],
        ["branch-letter", "项目遗言", "物件"],
        ["branch-stranger", "匿名继承者", "人群"],
        ["branch-timebox", "七日封存", "限制"],
      ] as const;
      await fulfill({
        expansion: {
          nodes: branchNodes.map(([id, label, category], index) => ({
            id,
            label,
            category,
            level: 2,
            x: 56 + index * 8,
            y: 35 + index * 10,
            selectable: true,
            locked: false,
            selected: false,
            reason: "从意外方向继续发散。",
            parentId,
            source: "圆桌方向",
          })),
          edges: branchNodes.map(([id]) => ({ id: `edge-${id}`, from: parentId, to: id, label: "圆桌分支" })),
          recommendedNodeIds: branchNodes.map(([id]) => id),
        },
      });
      return;
    }

    if (url.endsWith("/discussion")) {
      requests.discussion.push(body);
      const ideaId = readString(asRecord(body.idea), "id", "idea-1");
      await fulfill({
        discussion: {
          id: "discussion-1",
          ideaId,
          createdAt: "2026-07-13T00:00:00.000Z",
          status: "completed",
          participants: ["用户代言人", "反常识派", "跨界连接者", "现实构建者"],
          rounds: [
            {
              type: "judgment",
              contributions: [
                {
                  role: "用户代言人",
                  claim: "用户不会为了复盘失败而学习复杂流程。",
                  tension: "表达欲和操作成本发生冲突。",
                  spark: { id: "spark-entry", text: "把入口压缩成一次粘贴" },
                },
                {
                  role: "反常识派",
                  claim: "失败项目不一定要被修复，也可以被展示。",
                  tension: "成功叙事和失败价值发生冲突。",
                  spark: { id: "spark-exhibit", text: "让失败项目主动讲述自己的遗言" },
                },
                {
                  role: "跨界连接者",
                  claim: "借用博物馆策展方式组织仓库历史。",
                  tension: "代码事实和展览叙事需要同时可信。",
                  spark: { id: "spark-curator", text: "为每次关键提交生成一张展签" },
                },
                {
                  role: "现实构建者",
                  claim: "第一版只读取公开仓库和 README。",
                  tension: "完整分析和快速交付发生冲突。",
                  spark: { id: "spark-private", text: "先做只在本机生成的私密展览" },
                },
              ],
            },
            {
              type: "collision",
              contributions: [
                {
                  role: "反常识派",
                  claim: "越不完整的项目越值得获得正式展签。",
                  tension: "羞耻感可能成为分享动力。",
                  buildsOn: "用户代言人",
                },
              ],
            },
            {
              type: "synthesis",
              contributions: [
                {
                  role: "现实构建者",
                  claim: "先让用户私密生成，再决定是否公开。",
                  tension: "趣味性不能牺牲安全感。",
                  buildsOn: "反常识派",
                },
              ],
            },
          ],
          synthesis: {
            conservativeDirection: { title: "私密复盘卡", description: "本地读取仓库并生成失败展签。", nextStep: "做一个单页粘贴入口。" },
            radicalDirection: { title: "公开失败博物馆", description: "把失败项目整理成可分享展览。", nextStep: "邀请三位开发者公开一件作品。" },
            unexpectedDirection: { title: "项目遗言交换所", description: "让开发者交换未完成项目留下的话。", nextStep: "先收集十条匿名项目遗言。" },
          },
          collectedSparkIds: [],
          interventions: [],
        },
      });
      return;
    }

    if (url.endsWith("/mix")) {
      requests.mix.push(body);
      const sourceIdeaTitles = readRecords(body.ideas).map((idea) => readString(idea, "title"));
      await fulfill({
        seed: {
          mixedTopic: "失败作品集博物馆",
          theme: "把旧项目的失败经验变成可以展示的资产",
          tension: "羞耻感和炫耀欲之间的拉扯",
          startingPrompt: "给独立开发者做一个能把烂尾仓库生成作品集展签的工具。",
          sourceIdeaTitles,
          createdAt: "2026-07-08T00:00:00.000Z",
        },
      });
      return;
    }

    await route.abort();
  });

  return requests;
}

// 从首页提交主题并等待第一张思维导图稳定下来。
async function startMindMap(page: Page, topic: string): Promise<void> {
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "home");
  await expect(page.getByLabel("主题")).toBeVisible();
  await page.getByLabel("主题").fill(topic);
  await page.getByRole("button", { name: "开始发散", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "map");
  await expect(page.getByLabel("主题")).toBeHidden();
  await expect(page.getByLabel("创意阶段")).toBeHidden();
  await expect(page.getByLabel("思维星图舞台")).toBeVisible();
  await expect(page.getByLabel("思维星图舞台")).toHaveAttribute("aria-busy", "false");
}

test("quick path enters a keyword canvas without opening deep tools", async ({ page }) => {
  await installIdeaApiMocks(page);
  await startMindMap(page, "我想做一个有趣的开发者工具");

  const collisionButton = page.getByRole("button", { name: "用这些词碰撞", exact: true });
  await expect(collisionButton).toBeDisabled();
  await expect(page.getByRole("dialog", { name: "选择碰撞方式" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "换个立场", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "召集讨论", exact: true })).toHaveCount(0);

  const crowdNode = page.getByRole("button", { name: "换人群 人群节点", exact: true });
  await expect(crowdNode).toHaveAttribute("aria-pressed", "false");
  const initialBox = await crowdNode.boundingBox();
  if (!initialBox) {
    throw new Error("人群节点没有可拖动区域");
  }
  await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(initialBox.x + initialBox.width / 2 + 80, initialBox.y + initialBox.height / 2 + 24, { steps: 5 });
  await page.mouse.up();
  const draggedBox = await crowdNode.boundingBox();
  expect(draggedBox?.x ?? 0).toBeGreaterThan(initialBox.x + 30);

  await page.getByRole("button", { name: "返回首页", exact: true }).click();
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "home");
  await expect(page.getByLabel("主题")).toBeVisible();
});

test("discussion path accepts a user intervention and grows a traceable branch", async ({ page }) => {
  const requests = await installIdeaApiMocks(page);
  await startMindMap(page, "我想做一个有趣的开发者工具");

  for (const label of ["换人群 人群节点", "换场景 场景节点", "放大情绪 情绪节点"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await page.getByRole("button", { name: "用这些词碰撞", exact: true }).click();
  await page.getByRole("dialog", { name: "选择碰撞方式" }).getByRole("button", { name: /^随机碰撞/ }).click();

  await expect(page.locator("main")).toHaveAttribute("data-app-view", "ideas");
  await page.getByRole("button", { name: "烂尾复盘器", exact: true }).click();
  const report = page.locator("article");
  await report.getByRole("button", { name: "召集讨论", exact: true }).click();
  await report.getByRole("button", { name: "召集讨论", exact: true }).click();

  const discussion = report.getByRole("region", { name: "创意编辑部讨论" });
  await expect(discussion).toBeVisible();
  await expect(discussion).toContainText("用户代言人");
  await expect(discussion).toContainText("反常识派");
  await expect(discussion).toContainText("跨界连接者");
  await expect(discussion).toContainText("现实构建者");
  await expect(discussion).toContainText("判断");
  await expect(discussion).toContainText("碰撞");
  await expect(discussion).toContainText("收束");
  await expect(discussion.getByRole("region", { name: "讨论方向" })).toContainText("保守方向");
  await expect(discussion.getByRole("region", { name: "讨论方向" })).toContainText("激进方向");
  await expect(discussion.getByRole("region", { name: "讨论方向" })).toContainText("意外方向");

  await discussion.getByRole("button", { name: "追问 用户代言人", exact: true }).click();
  const interventionForm = discussion.getByRole("form", { name: "加入讨论" });
  await expect(interventionForm).toBeVisible();
  await interventionForm.getByLabel("介入动作").selectOption("question");
  await interventionForm.getByLabel("回应角色").selectOption("反常识派");
  const userThought = "如果用户不愿公开失败，能否先给他一个只有自己可见的版本？";
  expect(userThought.length).toBeLessThanOrEqual(180);
  await interventionForm.getByLabel("你的想法").fill(userThought);
  await interventionForm.getByRole("button", { name: "请编辑部回应", exact: true }).click();
  await expect.poll(() => requests.discussionResponse.length).toBe(1);
  expect(requests.discussionResponse[0]).toMatchObject({
    type: "question",
    prompt: userThought,
    targetRole: "反常识派",
    sourceRole: "用户代言人",
  });
  const interventionRegion = discussion.getByRole("region", { name: "用户介入" });
  await expect(interventionRegion).toContainText(userThought);
  await expect(interventionRegion).toContainText("如果入口保持私密");
  await expect(interventionRegion).toContainText("公开表达欲与失败羞耻");

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "ideas");
  await page.getByRole("button", { name: "烂尾复盘器", exact: true }).click();
  const restoredDiscussion = page.getByRole("region", { name: "创意编辑部讨论" });
  await expect(restoredDiscussion).toContainText("三个可继续发展的方向");
  await expect(restoredDiscussion.getByRole("region", { name: "用户介入" })).toContainText(userThought);

  await restoredDiscussion.getByRole("button", { name: "意外方向 项目遗言交换所", exact: true }).click();
  await restoredDiscussion.getByRole("button", { name: "沿这个方向继续", exact: true }).click();
  await expect.poll(() => requests.discussionBranch.length).toBe(1);
  expect(requests.discussionBranch[0]).toMatchObject({ directionKey: "unexpectedDirection" });
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "map");
  for (const [category, label] of [["换场景", "告别仪式"], ["找载体", "项目遗言"], ["换人群", "匿名继承者"], ["加限制", "七日封存"]] as const) {
    await expect(page.getByRole("button", { name: `${category} ${label}`, exact: true })).toBeVisible();
  }

  const persistedOrigins = await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem("idea-lab:v2") ?? "{}") as { workspace?: { mindMap?: { nodes?: Array<{ id?: string; discussionOrigin?: unknown }> } } };
    return (stored.workspace?.mindMap?.nodes ?? [])
      .filter((node) => node.id?.startsWith("branch-"))
      .map((node) => node.discussionOrigin);
  });
  expect(persistedOrigins).toHaveLength(4);
  expect(persistedOrigins).toEqual(Array(4).fill({ ideaId: "idea-1", discussionId: "discussion-1", directionKey: "unexpectedDirection" }));

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByRole("button", { name: "换场景 告别仪式", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "找载体 项目遗言", exact: true })).toHaveCount(0);
});

test("deep path supports collision recipe, challenge, refinement, and incubation", async ({ page }) => {
  const requests = await installIdeaApiMocks(page);
  await startMindMap(page, "我想做一个有趣的开发者工具");

  const selectedNodeLabels = ["换人群 人群节点", "换场景 场景节点", "放大情绪 情绪节点"];
  for (const label of selectedNodeLabels) {
    const node = page.getByRole("button", { name: label, exact: true });
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "true");
  }

  const collisionButton = page.getByRole("button", { name: "用这些词碰撞", exact: true });
  await expect(collisionButton).toBeEnabled();
  await expect(page.getByRole("dialog", { name: "选择碰撞方式" })).toHaveCount(0);
  await collisionButton.click();

  const recipeDialog = page.getByRole("dialog", { name: "选择碰撞方式" });
  await expect(recipeDialog).toBeVisible();
  await recipeDialog.getByRole("button", { name: /^随机碰撞/ }).click();
  await expect.poll(() => requests.ideas.length).toBe(1);
  expect(requests.ideas[0]).toMatchObject({ collisionRecipe: "random" });

  await expect(page.locator("main")).toHaveAttribute("data-app-view", "ideas");
  const originRegion = page.getByRole("region", { name: "来源星座" });
  await expect(originRegion).toBeVisible();
  await expect(originRegion.getByText("这组节点碰撞出了当前脑洞")).toBeVisible();
  await expect(originRegion.getByRole("button", { name: "返回来源位置", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "烂尾复盘器", exact: true }).click();
  await expect(page.getByRole("heading", { name: "烂尾复盘器", exact: true })).toBeVisible();
  const originalReport = page.locator("article");
  await originalReport.getByRole("button", { name: "收藏", exact: true }).click();
  await expect(originalReport.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();

  await page.locator("summary").filter({ hasText: "换个角度" }).click();
  await page.getByRole("button", { name: "更游戏化一点", exact: true }).click();
  await expect(page.getByRole("heading", { name: "烂尾复盘器 · 更游戏化一点", exact: true })).toBeVisible();
  const transformedReport = page.locator("article");
  const transformedTitle = await transformedReport.locator("h3").innerText();
  await expect(transformedReport.getByRole("region", { name: "来源星座" })).toBeVisible();

  await transformedReport.getByRole("button", { name: "反共识挑战", exact: true }).click();
  const challengePanel = page.getByRole("region", { name: "反共识挑战" });
  await challengePanel.getByRole("button", { name: "换个立场", exact: true }).click();
  const roleGroup = challengePanel.getByRole("group", { name: "选择挑战角色" });
  await expect(roleGroup).toBeVisible();
  await roleGroup.getByRole("button", { name: "懒人用户", exact: true }).click();
  await expect.poll(() => requests.challenge.length).toBe(1);
  expect(requests.challenge[0]).toMatchObject({ role: "懒人用户" });
  const challengeNotes = challengePanel.getByRole("region", { name: "反共识批注" });
  await expect(challengeNotes).toBeVisible();
  await expect(challengeNotes).toContainText("质疑");
  await expect(challengeNotes).toContainText("懒人用户只想一键完成");
  await expect(challengeNotes).toContainText("用户可能没有耐心");
  await expect(challengeNotes).toContainText("一次粘贴");

  await transformedReport.getByRole("button", { name: "返回报告摘要", exact: true }).click();
  await transformedReport.getByRole("button", { name: "深入验证", exact: true }).click();
  await expect.poll(() => requests.refine.length).toBe(1);
  await expect(page.getByRole("heading", { name: "生命力与推进路径", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "收束推进", exact: true }).click();
  await expect(page.getByText("执行计划", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "从一小时到一周", exact: true })).toBeVisible();

  await transformedReport.getByRole("button", { name: "返回报告摘要", exact: true }).click();
  const transformedFavoriteButton = transformedReport.getByRole("button", { name: "收藏", exact: true });
  if (await transformedFavoriteButton.count() > 0) await transformedFavoriteButton.click();
  await expect(transformedReport.getByRole("button", { name: "取消收藏", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "孵化箱 2", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "孵化箱 2", exact: true }).click();
  const incubator = page.getByRole("dialog", { name: "孵化箱" });
  await expect(incubator).toBeVisible();
  await expect(incubator.getByText("挑 2 到 3 个旧想法，混成下一张导图。", { exact: true })).toBeVisible();
  await incubator.getByRole("button", { name: "选择 烂尾复盘器", exact: true }).click();
  await incubator.getByRole("button", { name: `选择 ${transformedTitle}`, exact: true }).click();
  await expect(incubator.getByText("已选 2 个想法", { exact: true })).toBeVisible();
  await incubator.getByRole("button", { name: "混合一下", exact: true }).click();
  await expect.poll(() => requests.mix.length).toBe(1);
  await expect.poll(() => requests.map.length).toBe(2);
  expect(readRecords(requests.mix[0]?.ideas)).toHaveLength(2);
  await expect(incubator).toBeHidden();
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "map");
  await expect(page.getByRole("heading", { name: "失败作品集博物馆", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-app-view", "map");
  await expect(page.getByRole("button", { name: "孵化箱 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "孵化箱 2", exact: true }).click();
  const incubatorAfterReload = page.getByRole("dialog", { name: "孵化箱" });
  await expect(incubatorAfterReload.getByText(transformedTitle, { exact: true })).toBeVisible();
  const refinedFavorite = incubatorAfterReload.getByRole("article").filter({ hasText: transformedTitle });
  await refinedFavorite.getByRole("heading", { name: transformedTitle, exact: true }).click();
  await expect(incubatorAfterReload.getByText("炼化结果", { exact: true })).toBeVisible();
});
