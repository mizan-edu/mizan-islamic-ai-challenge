// Single place where Anthropic clients are created (classifier and rephraser).
// Console user keys (sk-ant-usr-...) are not scoped to a workspace, so every request must carry the
// anthropic-workspace-id header: when ANTHROPIC_WORKSPACE_ID is set, it is sent as a default header
// on every call made through the client. The key itself is read by the SDK; it is never logged.

import Anthropic from '@anthropic-ai/sdk';

export const WORKSPACE_HEADER = 'anthropic-workspace-id';

export function workspaceHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | undefined {
  const id = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return id ? { [WORKSPACE_HEADER]: id } : undefined;
}

export function createAnthropicClient(env: NodeJS.ProcessEnv = process.env): Anthropic {
  const headers = workspaceHeaders(env);
  return new Anthropic({
    ...(env.ANTHROPIC_API_KEY ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
    ...(headers ? { defaultHeaders: headers } : {}),
  });
}
