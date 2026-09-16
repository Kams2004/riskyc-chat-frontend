import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

export type GroupMemberResult = { userId: string; role: 'ADMIN' | 'MEMBER' };

export type GroupResult = {
  id: string;
  name: string;
  avatarObjectKey: string | null;
  createdBy: string;
  onlyAdminsCanMessage: boolean;
  members: GroupMemberResult[];
};

export function createGroup(name: string, memberIds: string[], avatarObjectKey?: string | null): Promise<GroupResult> {
  return apiFetch(`${config.messagingServiceUrl}/api/groups`, {
    method: 'POST',
    body: JSON.stringify({ name, memberIds, avatarObjectKey: avatarObjectKey ?? null }),
  });
}

export function getGroup(groupId: string): Promise<GroupResult> {
  return apiFetch(`${config.messagingServiceUrl}/api/groups/${groupId}`);
}

export function getCommonGroups(otherUserId: string): Promise<GroupResult[]> {
  return apiFetch(`${config.messagingServiceUrl}/api/groups/common/${otherUserId}`);
}
