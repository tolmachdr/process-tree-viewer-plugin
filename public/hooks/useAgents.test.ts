/**
 * Tests for the useAgents hook.
 *
 * Requirements:
 *   - jest
 *   - @testing-library/react-hooks  (or renderHook from @testing-library/react v13+)
 *   - react-test-renderer (peer dependency of renderHook)
 *
 * Run from the OSD monorepo root:
 *   yarn jest plugins/processTreeViewer/public/hooks/useAgents.test.ts
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { useAgents } from './useAgents';

const makeHttp = (overrides: Partial<{ get: jest.Mock; post: jest.Mock }> = {}) => ({
  get: jest.fn(),
  post: jest.fn(),
  ...overrides,
});

const MOCK_AGENTS = [
  { id: 'agent-001', name: 'linux-host-01', count: 42 },
  { id: 'agent-002', name: 'win-host-02', count: 17 },
];

describe('useAgents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not make an HTTP request when selectedIndex is empty', () => {
    const http = makeHttp();
    renderHook(() => useAgents(http, ''));

    expect(http.get).not.toHaveBeenCalled();
  });

  it('initial state without an index: agents=[], loadingAgents=false', () => {
    const http = makeHttp();
    const { result } = renderHook(() => useAgents(http, ''));

    expect(result.current.agents).toHaveLength(0);
    expect(result.current.loadingAgents).toBe(false);
  });

  it('starts loading when selectedIndex is provided', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: true, agents: MOCK_AGENTS }),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'wazuh-alerts-*')
    );

    expect(result.current.loadingAgents).toBe(true);
    await waitForNextUpdate();

    expect(result.current.loadingAgents).toBe(false);
    expect(result.current.agents).toEqual(MOCK_AGENTS);
  });

  it('calls GET /api/process_tree/agents/{index} with URI-encoded index', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: true, agents: [] }),
    });
    const { waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'wazuh/alerts-*')
    );
    await waitForNextUpdate();

    expect(http.get).toHaveBeenCalledWith(
      `/api/process_tree/agents/${encodeURIComponent('wazuh/alerts-*')}`
    );
  });

  it('network error: agents=[], loadingAgents=false', async () => {
    const http = makeHttp({
      get: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'some-index')
    );
    await waitForNextUpdate();

    expect(result.current.agents).toHaveLength(0);
    expect(result.current.loadingAgents).toBe(false);
  });

  it('success=false response: agents=[]', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: false }),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'some-index')
    );
    await waitForNextUpdate();

    expect(result.current.agents).toHaveLength(0);
  });

  it('response without agents field: agents=[]', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: true }), // no agents key
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'some-index')
    );
    await waitForNextUpdate();

    expect(result.current.agents).toHaveLength(0);
  });

  it('re-fetches when selectedIndex changes', async () => {
    const secondBatch = [{ id: 'agent-003', name: 'linux-host-03', count: 5 }];
    const http = makeHttp({
      get: jest
        .fn()
        .mockResolvedValueOnce({ success: true, agents: MOCK_AGENTS })
        .mockResolvedValueOnce({ success: true, agents: secondBatch }),
    });

    let selectedIndex = 'index-1';
    const { result, waitForNextUpdate, rerender } = renderHook(() =>
      useAgents(http, selectedIndex)
    );
    await waitForNextUpdate();

    expect(result.current.agents).toEqual(MOCK_AGENTS);

    selectedIndex = 'index-2';
    rerender();
    await waitForNextUpdate();

    expect(result.current.agents).toEqual(secondBatch);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('clears agents immediately when loadAgents() is called again', async () => {
    const http = makeHttp({
      get: jest
        .fn()
        .mockResolvedValueOnce({ success: true, agents: MOCK_AGENTS })
        .mockReturnValueOnce(new Promise(() => {})), // second call never resolves
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useAgents(http, 'some-index')
    );
    await waitForNextUpdate();

    expect(result.current.agents).toEqual(MOCK_AGENTS);

    act(() => {
      result.current.loadAgents();
    });

    // While the second request is in-flight, agents should be reset to []
    expect(result.current.agents).toHaveLength(0);
  });
});
