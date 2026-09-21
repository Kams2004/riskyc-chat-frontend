import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

/** Exact mirror of mobile's features/calls/api.ts. */
export type CallResult = {
  id: string;
  callerId: string;
  calleeId: string;
  type: 'AUDIO' | 'VIDEO';
  status: 'RINGING' | 'ACCEPTED' | 'DECLINED' | 'MISSED' | 'ENDED';
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  callerBytesSent: number | null;
  callerBytesReceived: number | null;
  calleeBytesSent: number | null;
  calleeBytesReceived: number | null;
};

export function listCallHistory(): Promise<CallResult[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/calls`);
}
