import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLeadsQuery } from '../src/hooks/useLeadsQuery';
import * as api from '../src/services/api';

jest.mock('../src/services/api');

describe('useLeadsQuery Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches initial leads on mount and updates state', async () => {
    const mockLeads = [
      {
        id: 'lead_1',
        formId: 'f1',
        pageId: 'p1',
        name: 'Alice',
        email: 'alice@example.com',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:00:00.000Z',
      },
    ];

    (api.fetchLeads as jest.Mock).mockResolvedValueOnce(mockLeads);

    const { result } = renderHook(() => useLeadsQuery());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.leads).toEqual(mockLeads);
    expect(result.current.error).toBeNull();
    expect(api.fetchLeads).toHaveBeenCalledTimes(1);
    expect(api.fetchLeads).toHaveBeenCalledWith(undefined);
  });

  it('handles fetch failure and sets error state', async () => {
    const fetchError = new Error('Network timeout');
    (api.fetchLeads as jest.Mock).mockRejectedValueOnce(fetchError);

    const { result } = renderHook(() => useLeadsQuery());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(fetchError);
    expect(result.current.leads).toEqual([]);
  });

  it('merges delta leads on refetch(since) without duplicating IDs', async () => {
    const initialLeads = [
      {
        id: 'lead_1',
        formId: 'f1',
        pageId: 'p1',
        name: 'Alice',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:00:00.000Z',
      },
    ];

    (api.fetchLeads as jest.Mock).mockResolvedValueOnce(initialLeads);

    const { result } = renderHook(() => useLeadsQuery());

    await waitFor(() => {
      expect(result.current.leads).toHaveLength(1);
    });

    // Delta fetch returns existing lead_1 plus new lead_2
    const deltaLeads = [
      {
        id: 'lead_2',
        formId: 'f1',
        pageId: 'p1',
        name: 'Bob',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:05:00.000Z',
      },
      {
        id: 'lead_1',
        formId: 'f1',
        pageId: 'p1',
        name: 'Alice',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:00:00.000Z',
      },
    ];

    (api.fetchLeads as jest.Mock).mockResolvedValueOnce(deltaLeads);

    await act(async () => {
      await result.current.refetch('2026-10-12T10:00:00.000Z');
    });

    // Should have lead_2 (newest) and lead_1, no duplicates
    expect(result.current.leads).toHaveLength(2);
    expect(result.current.leads[0].id).toBe('lead_2');
    expect(result.current.leads[1].id).toBe('lead_1');
  });
});
