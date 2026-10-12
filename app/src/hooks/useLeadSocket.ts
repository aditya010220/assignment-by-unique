import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ConnectionStatus, Lead } from '../types/lead';
import { getServerUrl } from '../services/api';

export interface UseLeadSocketOptions {
  serverUrl?: string;
  onNewLead?: (lead: Lead) => void;
  onReconnect?: (lastSeenTimestamp?: string) => void;
  lastSeenTimestamp?: string;
}

export interface UseLeadSocketResult {
  connectionStatus: ConnectionStatus;
  socket: Socket | null;
}

export function useLeadSocket(options: UseLeadSocketOptions = {}): UseLeadSocketResult {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  const onNewLeadRef = useRef(options.onNewLead);
  const onReconnectRef = useRef(options.onReconnect);
  const lastSeenRef = useRef(options.lastSeenTimestamp);

  useEffect(() => {
    onNewLeadRef.current = options.onNewLead;
  }, [options.onNewLead]);

  useEffect(() => {
    onReconnectRef.current = options.onReconnect;
  }, [options.onReconnect]);

  useEffect(() => {
    lastSeenRef.current = options.lastSeenTimestamp;
  }, [options.lastSeenTimestamp]);

  const targetUrl = options.serverUrl || getServerUrl();

  useEffect(() => {
    setConnectionStatus('connecting');

    const socket: Socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    setSocketInstance(socket);

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    // When connection recovers after drop
    socket.io.on('reconnect', () => {
      setConnectionStatus('connected');
      if (onReconnectRef.current) {
        onReconnectRef.current(lastSeenRef.current);
      }
    });

    // Listen for incoming live lead event
    socket.on('new-lead', (lead: Lead) => {
      if (onNewLeadRef.current) {
        onNewLeadRef.current(lead);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [targetUrl]);

  return {
    connectionStatus,
    socket: socketInstance,
  };
}
