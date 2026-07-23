// 这个文件定义可选的 OpenAI 兼容模型提供商；密钥只通过环境变量读取。

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  keyEnv: string;
}

const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  { id: "relay", label: "自定义中转站", baseUrl: "https://sub2.congmingai.com", model: "gpt-5.5", keyEnv: "IDEA_AI_API_KEY" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com", model: "gpt-5.2", keyEnv: "OPENAI_API_KEY" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api", model: "openai/gpt-5.2", keyEnv: "OPENROUTER_API_KEY" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash", keyEnv: "DEEPSEEK_API_KEY" },
  { id: "moonshot", label: "Moonshot / Kimi", baseUrl: "https://api.moonshot.cn", model: "kimi-k3", keyEnv: "MOONSHOT_API_KEY" },
  { id: "siliconflow", label: "SiliconFlow", baseUrl: "https://api.siliconflow.cn", model: "Pro/zai-org/GLM-4.7", keyEnv: "SILICONFLOW_API_KEY" },
  { id: "custom", label: "其他 OpenAI 兼容服务", baseUrl: "https://sub2.congmingai.com", model: "gpt-5.5", keyEnv: "IDEA_AI_API_KEY" },
];

// 根据环境变量选择预设；未知值按自定义服务处理，避免升级后服务直接启动失败。
export function resolveProvider(providerId: string | undefined): ProviderPreset {
  const normalizedId = providerId?.trim().toLowerCase();
  return PROVIDER_PRESETS.find((provider) => provider.id === normalizedId) ?? PROVIDER_PRESETS.find((provider) => provider.id === "openai")!;
}

// 返回可用于文档和配置界面的提供商列表，不暴露任何密钥。
export function listProviderPresets(): readonly ProviderPreset[] {
  return PROVIDER_PRESETS;
}
