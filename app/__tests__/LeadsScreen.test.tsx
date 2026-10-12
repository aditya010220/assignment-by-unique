import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { LeadsScreen } from '../src/screens/LeadsScreen';
import * as leadsQueryHook from '../src/hooks/useLeadsQuery';
import * as leadSocketHook from '../src/hooks/useLeadSocket';
import { Lead } from '../src/types/lead';

jest.mock('../src/hooks/useLeadsQuery');
jest.mock('../src/hooks/useLeadSocket');

describe('LeadsScreen Component', () => {
  let mockSetLeads: jest.Mock;
  let mockRefetch: jest.Mock;
  let capturedSocketOptions: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLeads = jest.fn();
    mockRefetch = jest.fn();
    capturedSocketOptions = {};

    (leadSocketHook.useLeadSocket as jest.Mock).mockImplementation((opts) => {
      capturedSocketOptions = opts;
      return {
        connectionStatus: 'connected',
        socket: null,
      };
    });
  });

  it('renders empty state when there are no leads', () => {
    (leadsQueryHook.useLeadsQuery as jest.Mock).mockReturnValue({
      leads: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    render(<LeadsScreen />);

    expect(screen.getByText('No leads received yet')).toBeTruthy();
    expect(screen.getByText('0 Leads Captured')).toBeTruthy();
  });

  it('renders a populated list of leads with details', () => {
    const mockLeads: Lead[] = [
      {
        id: 'lead_101',
        formId: 'form_alpha',
        pageId: 'page_beta',
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
        phone: '+14155552671',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:00:00.000Z',
      },
    ];

    (leadsQueryHook.useLeadsQuery as jest.Mock).mockReturnValue({
      leads: mockLeads,
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    render(<LeadsScreen />);

    expect(screen.getByText('Sarah Connor')).toBeTruthy();
    expect(screen.getByText('sarah@skynet.com')).toBeTruthy();
    expect(screen.getByText('+14155552671')).toBeTruthy();
    expect(screen.getByText('ID: lead_101')).toBeTruthy();
    expect(screen.getByText('1 Lead Captured')).toBeTruthy();
  });

  it('reflects connection status badge according to socket state', () => {
    (leadsQueryHook.useLeadsQuery as jest.Mock).mockReturnValue({
      leads: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    // 1. Connected -> LIVE
    (leadSocketHook.useLeadSocket as jest.Mock).mockReturnValue({
      connectionStatus: 'connected',
      socket: null,
    });
    const { rerender } = render(<LeadsScreen />);
    expect(screen.getByTestId('connection-status-text').props.children).toBe('LIVE');

    // 2. Connecting -> CONNECTING
    (leadSocketHook.useLeadSocket as jest.Mock).mockReturnValue({
      connectionStatus: 'connecting',
      socket: null,
    });
    rerender(<LeadsScreen />);
    expect(screen.getByTestId('connection-status-text').props.children).toBe('CONNECTING');

    // 3. Disconnected -> OFFLINE
    (leadSocketHook.useLeadSocket as jest.Mock).mockReturnValue({
      connectionStatus: 'disconnected',
      socket: null,
    });
    rerender(<LeadsScreen />);
    expect(screen.getByTestId('connection-status-text').props.children).toBe('OFFLINE');
  });

  it('prepends new-lead event to the list without duplicates', () => {
    let currentLeads: Lead[] = [
      {
        id: 'lead_existing',
        formId: 'f1',
        pageId: 'p1',
        name: 'Existing Lead',
        rawFieldData: {},
        receivedAt: '2026-10-12T10:00:00.000Z',
      },
    ];

    mockSetLeads.mockImplementation((updater) => {
      currentLeads = typeof updater === 'function' ? updater(currentLeads) : updater;
    });

    (leadsQueryHook.useLeadsQuery as jest.Mock).mockReturnValue({
      leads: currentLeads,
      loading: false,
      error: null,
      refetch: mockRefetch,
      setLeads: mockSetLeads,
    });

    render(<LeadsScreen />);

    const newIncomingLead: Lead = {
      id: 'lead_incoming_999',
      formId: 'f1',
      pageId: 'p1',
      name: 'Fresh Lead',
      email: 'fresh@example.com',
      rawFieldData: {},
      receivedAt: '2026-10-12T10:05:00.000Z',
    };

    act(() => {
      capturedSocketOptions.onNewLead(newIncomingLead);
    });

    expect(mockSetLeads).toHaveBeenCalled();
    expect(currentLeads).toHaveLength(2);
    expect(currentLeads[0].id).toBe('lead_incoming_999');

    // Duplicate incoming lead with same id is ignored
    act(() => {
      capturedSocketOptions.onNewLead(newIncomingLead);
    });
    expect(currentLeads).toHaveLength(2);
  });
});
