# 脑洞实验室架构说明

## 模块职责

- `app/src/types/idea.ts`：定义维度词、发散思维导图、脑洞卡片、可配置阵容与机制的三轮结构化讨论、脑洞炼化结果、孵化箱筛选、混合种子、收藏和会话类型。
- `app/src/lib/ideaEngine.ts`：把导图节点转换为碰撞词，并追溯节点来源路径。
- `app/src/services/ideaApi.ts`：统一处理前端 AI 请求；读取本地代理 SSE，失败时把错误抛给 store，不做本地 fallback。
- `app/src/store/storage.ts`：校验、迁移和保存 localStorage V2 工作区与孵化条目。
- `app/src/store/ideaStore.ts`：管理主题、导图、节点位置、镜头临时状态、脑洞、炼化、孵化、流式进度、持久化和 AI 请求修订。
- `app/src/components/workbench/MindMapCanvas.tsx`：组合可平移缩放的无限导图视口、轻量控制栏和底部碰撞操作。
- `app/src/components/workbench/MindMapNode.tsx`：渲染可选择、锁定和拖动的导图节点，并把视口指针位置换算为世界坐标。
- `app/src/components/workbench/MindMapMinimap.tsx`：绘制全局节点缩略图和当前视口矩形，并支持点击定位。
- `app/src/components/workbench/MindMapSearch.tsx`：按标签、分类和来源搜索节点并触发局部聚焦。
- `app/src/components/workbench/MindMapNodeComposer.tsx`：处理用户手动新增节点的分类表单。
- `app/src/components/workbench/MindMapSelectionToolbar.tsx`：承载多节点锁定、解锁、碰撞和清除选择。
- `app/src/components/workbench/MindMapEdges.tsx`：按分支类别绘制三次贝塞尔曲线和高亮路径。
- `app/src/components/workbench/mindMapGeometry.ts`：处理世界/视口坐标、微缩图视口、框选、分支可见性和曲线几何。
- `app/src/components/workbench/MindMapActivity.tsx`：展示 AI 工作时的能量核、轨道、粒子和操作状态。
- `app/src/components/workbench/useMindMapMotion.ts`：用 GSAP 编排节点爆发、重掷收束、碰撞汇聚和连线绘制，并负责减少动态效果与清理。
- `app/src/components/workbench/IdeaCardList.tsx`：组合左侧脑洞标题导航和右侧单篇报告，并同步有效的当前脑洞。
- `app/src/components/workbench/IdeaCard.tsx`：编排报告摘要和单工具工作台；摘要负责判断与路径选择，工具模式负责验证、挑战、讨论或行动计划，避免多个模块同时展开。
- `app/src/components/workbench/IdeaRefinery.tsx`：把炼化结果排成方向对比表、执行时间线和编辑部批注。
- `app/src/components/workbench/IdeaChallengePanel.tsx`：在报告中按需选择反共识角色，并以连续编辑部批注展示挑战结果。
- `app/src/components/workbench/IdeaDiscussionPanel.tsx`：在报告中按需选择讨论阵容和思维机制，召集三轮讨论，支持锁定单条观点、有限介入、方向选择，并允许用户把火花、普通分支或对立分支送回画布。
- `app/src/components/workbench/CollisionRecipePicker.tsx`：只在用户主动碰撞时展示六种思维动作配方。
- `app/src/components/workbench/IncubatorModal.tsx`：渲染孵化箱弹窗，支持筛选、详情、多选和混合入口。
- `app/src/components/workbench/*`：实现主题输入、发散思维导图、维度词、碰撞台、脑洞卡片、炼化器和孵化箱弹窗。
- `app/server/index.ts`：启动本地 AI API 代理，提供 `/api/idea/map`、`/api/idea/words`、`/api/idea/ideas`、`/api/idea/transform`、`/api/idea/refine`、`/api/idea/challenge`、`/api/idea/discussion`、`/api/idea/discussion/respond`、`/api/idea/discussion/branch`、`/api/idea/mix`。
- `app/server/relayClient.ts`：调用 OpenAI 兼容 `/v1/chat/completions`，解析流式 delta。
- `app/server/promptBuilder.ts`：拼接系统提示词和用户提示词，并压缩上下文。
- `app/server/modelOutput.ts`：解析模型 JSON，整理成前端可用结构。
- `app/server/mindMapLayout.ts`：在首屏安全区内确定性散布初始节点，并让继续发散节点向无限画布外侧执行防重叠布局。
- `app/server/responseCache.ts`：按模型、操作和压缩输入做内存缓存。
- `app/server/config.ts`：读取 `.env.local` 或系统环境变量中的提供商、模型、中转站和队列配置。
- `app/server/providers.ts`：保存不含密钥的 OpenAI 兼容提供商预设，并解析提供商对应的 key 环境变量。
- `app/server/originPolicy.ts`：限制可以调用本机 AI 代理的网页来源，并生成对应 CORS 响应头。
- `app/server/llmGateway.ts`：处理请求去重、缓存、并发槽、有界队列和端到端截止时间。

## 数据流

用户输入主题后，`TopicComposer` 调用 `ideaStore.generateMindMap()`，页面立即切换到全屏能量碰撞层。store 通过 `ideaApi.generateMindMap()` 请求同源 `/api/idea/map`，代理先校验来源和队列容量，再调用中转站并通过 SSE 返回结果。响应提交前同时校验请求编号和主题/导图修订号，避免旧结果覆盖用户的新操作。`mindMapLayout.ts` 把节点散布到桌面安全区，`useMindMapMotion.ts` 再从中心或父节点播放爆发动画；AI 工作和动画收尾期间画布保持锁定。用户随后可以在 `MindMapCanvas` 中平移缩放、拖动、框选、搜索和折叠节点；本地编辑进入 50 步有限历史，微缩星图只读取视口和导图数据。默认关键词路径不展示配方、挑战或讨论；用户主动碰撞后，配方随请求进入服务端提示词并写入来源谱系。报告里的“换个立场”按需请求 `/api/idea/challenge`，“召集讨论”按需请求 `/api/idea/discussion` 并一次返回四角色三轮观点与三个方向。追问、不同意或补充通过 `/api/idea/discussion/respond` 只增加一轮有限回应；选择方向后 `/api/idea/discussion/branch` 生成 4-6 个节点，store 写入 `discussionOrigin`、记录一份撤销历史并返回来源画布。讨论、介入、采集状态和炼化计划进入 localStorage V2；生成新主题、混合或刷新不会删除已放入孵化箱的成果。

如果本地代理未启动、key 未配置、网络失败、模型输出无法解析，前端不会自动生成假内容。`ideaApi.ts` 抛出错误，`ideaStore.ts` 统一把 loading 恢复为 `idle`，并显示 `LLM 有问题：...`。浏览器和单元测试可以显式拦截 `/api/idea/*` SSE 响应，但产品运行时不做 mock 兜底。

## 关键决定

- 第一版只做单人本地 MVP，减少账号和后端复杂度；当前先完成导图脑暴和脑洞炼化，不做会话云同步、素材池和团队工作坊。
- AI key 只在本地 Node API 代理中读取，不进入前端环境变量和浏览器包。
- 本机 AI 代理只接受允许来源，并使用有界队列和端到端截止时间，避免网页借用密钥或请求无限堆积。
- 当前模型层采用 OpenAI 兼容协议；提供商通过 `IDEA_AI_PROVIDER` 选择，地址、模型和 key 环境变量均可覆盖。Anthropic、Gemini 等原生协议留给后续独立 adapter。
- 中转站直连被网络或 Cloudflare 拦截时，可通过 `IDEA_AI_PROXY_URL` 让代理层走本地 HTTP 代理。
- AI 请求集中在 service 层，组件不直接调用 fetch。
- AI 驱动功能不做本地 fallback；没有 AI 接口时必须暴露错误，避免用户误以为模型真的完成了思考。
- 提示词强制只输出 JSON，服务端再做结构校验，避免模型散文式输出把页面打崩。
- 炼化结果校验更严格：缺少六个圆桌角色、三种方向、三档 MVP 或三个动作时，服务端会返回 SSE error。
- 创意编辑部采用一次请求返回固定四角色、三轮观点和三个方向，不做无限角色互聊；模型缺少任一轮或固定角色时拒绝写入工作区。
- 讨论火花必须由用户主动采集才回写导图，避免 AI 输出自动堆满无限画布。
- 用户介入每场最多三次，每次只追加一轮回应；讨论方向分支必须包含 4-6 个节点并记录来源，整次分支写入同一条导图撤销历史。
- 混合结果只返回新的发散起点，不直接生成脑洞卡；这样旧想法会重新进入现有“导图 -> 碰撞 -> 脑洞”的主流程。
- 缓存放在服务端内存里，按操作、模型和输入缓存 10 分钟，减少重复请求。
- 上下文压缩在 `promptBuilder.ts` 完成，避免长主题或长脑洞撑爆请求。
- 当前桌面布局为首页、全屏导图、独立脑洞结果三个视图；本轮不把手机端作为专项验收范围。
- 报告页采用摘要先行的渐进式披露：新报告默认进入 `overview`，只展示核心判断和三个工具入口；已有讨论/挑战结果会恢复到对应工具，工具内统一提供返回摘要和上下文主操作。
- 动画只操作 transform、opacity 和 SVG 描边；Zustand 始终是业务状态源，`loading` 与动画收尾共同决定画布是否可交互。
