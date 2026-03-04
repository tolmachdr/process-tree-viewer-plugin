/**
 * Tests for the useIndices hook.
 *
 * Requirements:
 *   - jest
 *   - @testing-library/react-hooks  (or renderHook from @testing-library/react v13+)
 *   - react-test-renderer (peer dependency of renderHook)
 *
 * Run from the OSD monorepo root:
 *   yarn jest plugins/processTreeViewer/public/hooks/useIndices.test.ts
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { useIndices } from './useIndices';

const makeHttp = (overrides: Partial<{ get: jest.Mock; post: jest.Mock }> = {}) => ({
  get: jest.fn(),
  post: jest.fn(),
  ...overrides,
});

const MOCK_INDICES = [
  { index: 'wazuh-alerts-2024', health: 'green', status: 'open', 'docs.count': '1000', 'store.size': '5mb' },
  { index: 'wazuh-alerts-2023', health: 'yellow', status: 'open', 'docs.count': '500', 'store.size': '2mb' },
];

describe('useIndices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initial state: loadingIndices=true, indices=[], error=null', async () => {
    const http = makeHttp({ get: jest.fn(() => new Promise(() => {})) });
    const { result } = renderHook(() => useIndices(http));

    expect(result.current.loadingIndices).toBe(true);
    expect(result.current.indices).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('successful load: populates indices and clears loadingIndices', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: true, indices: MOCK_INDICES }),
    });
    const { result, waitForNextUpdate } = renderHook(() => useIndices(http));

    await waitForNextUpdate();

    expect(result.current.loadingIndices).toBe(false);
    expect(result.current.indices).toEqual(MOCK_INDICES);
    expect(result.current.error).toBeNull();
  });

  it('calls GET /api/process_tree/indices with pattern="*"', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: true, indices: [] }),
    });
    const { waitForNextUpdate } = renderHook(() => useIndices(http));
    await waitForNextUpdate();

    expect(http.get).toHaveBeenCalledWith(
      '/api/process_tree/indices',
      { query: { pattern: '*' } }
    );
  });

  it('network error: sets error message, clears loadingIndices, indices stays empty', async () => {
    const http = makeHttp({
      get: jest.fn().mockRejectedValue(new Error('Network failure')),
    });
    const { result, waitForNextUpdate } = renderHook(() => useIndices(http));
    await waitForNextUpdate();

    expect(result.current.loadingIndices).toBe(false);
    expect(result.current.error).toContain('Network failure');
    expect(result.current.indices).toHaveLength(0);
  });

  it('success=false response: indices stay empty, no error set', async () => {
    const http = makeHttp({
      get: jest.fn().mockResolvedValue({ success: false }),
    });
    const { result, waitForNextUpdate } = renderHook(() => useIndices(http));
    await waitForNextUpdate();

    expect(result.current.indices).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('calling loadIndices() again refreshes the list', async () => {
    const secondBatch = [
      { index: 'new-index', health: 'green', status: 'open', 'docs.count': '10', 'store.size': '1mb' },
    ];
    const http = makeHttp({
      get: jest
        .fn()
        .mockResolvedValueOnce({ success: true, indices: MOCK_INDICES })
        .mockResolvedValueOnce({ success: true, indices: secondBatch }),
    });
    const { result, waitForNextUpdate } = renderHook(() => useIndices(http));
    await waitForNextUpdate();

    expect(result.current.indices).toEqual(MOCK_INDICES);

    act(() => {
      result.current.loadIndices();
    });
    await waitForNextUpdate();

    expect(result.current.indices).toEqual(secondBatch);
    expect(http.get).toHaveBeenCalledTimes(2);
  });
});
