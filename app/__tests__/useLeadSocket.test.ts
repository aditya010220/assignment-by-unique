import { renderHook, act } from '@testing-library/react-native';
import { useLeadSocket } from '../src/hooks/useLeadSocket';
import { io } from 'socket.io-client';

jest.mock('socket.io-client');

describe('useLeadSocket Hook', () => {
  let mockSocket: any;
  let socketEventHandlers: Record<string, Function>;
  let managerEventHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    socketEventHandlers = {};
    managerEventHandlers = {};

    mockSocket = {
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers[event] = handler;
        return mockSocket;
      }),
      io: {
        on: jest.fn((event: string, handler: Function) => {
          managerEventHandlers[event] = handler;
          return mockSocket.io;
        }),
      },
      disconnect: jest.fn(),
    };

    (io as jest.Mock).mockReturnValue(mockSocket);
  });

  it('initializes socket and tracks connected / disconnected states', () => {
    const { result } = renderHook(() => useLeadSocket());

    expect(result.current.connectionStatus).toBe('connecting');
    expect(io).toHaveBeenCalledTimes(1);

    // Simulate socket connect event
    act(() => {
      socketEventHandlers['connect']?.();
    });
    expect(result.current.connectionStatus).toBe('connected');

    // Simulate socket disconnect event
    act(() => {
      socketEventHandlers['disconnect']?.();
    });
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('triggers onNewLead callback when new-lead event is emitted', () => {
    const onNewLeadMock = jest.fn();
    renderHook(() => useLeadSocket({ onNewLead: onNewLeadMock }));

    const sampleLead = {
      id: 'lead_live_123',
      formId: 'f1',
      pageId: 'p1',
      name: 'Sam Live',
      email: 'sam@example.com',
      rawFieldData: {},
      receivedAt: '2026-10-12T10:10:00.000Z',
    };

    act(() => {
      socketEventHandlers['new-lead']?.(sampleLead);
    });

    expect(onNewLeadMock).toHaveBeenCalledWith(sampleLead);
  });

  it('calls onReconnect with lastSeenTimestamp when socket reconnects', () => {
    const onReconnectMock = jest.fn();
    renderHook(() =>
      useLeadSocket({
        onReconnect: onReconnectMock,
        lastSeenTimestamp: '2026-10-12T10:10:00.000Z',
      })
    );

    act(() => {
      managerEventHandlers['reconnect']?.();
    });

    expect(onReconnectMock).toHaveBeenCalledWith('2026-10-12T10:10:00.000Z');
  });

  it('disconnects socket on hook unmount', () => {
    const { unmount } = renderHook(() => useLeadSocket());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });
});
