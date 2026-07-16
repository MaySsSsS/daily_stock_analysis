import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('../index', () => ({
  default: {
    post,
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const { agentApi } = await import('../agent');

describe('agentApi.chatStream', () => {
  let originalUserAgent: string;

  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
    post.mockReset();
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('uses the buffered chat endpoint on mobile browsers', async () => {
    const payload = { message: '分析 600519', session_id: 'mobile-session' };
    post.mockResolvedValue({
      data: {
        success: true,
        content: '移动端分析结果',
        session_id: 'mobile-session',
      },
    });

    const response = await agentApi.chatStream(payload);
    const body = await response.text();

    expect(post).toHaveBeenCalledWith('/api/v1/agent/chat', payload, { timeout: 300000 });
    expect(body).toContain('"type":"done"');
    expect(body).toContain('移动端分析结果');
  });
});
