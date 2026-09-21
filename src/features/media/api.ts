import { config } from '../../lib/config';
import { apiFetch } from '../../lib/httpClient';

export type UploadUrlResponse = { objectKey: string; uploadUrl: string };
export type DownloadUrlResponse = { downloadUrl: string };

export function createUploadUrl(): Promise<UploadUrlResponse> {
  return apiFetch(`${config.mediaServiceUrl}/api/media/upload-url`, { method: 'POST' });
}

export function createDownloadUrl(objectKey: string): Promise<DownloadUrlResponse> {
  return apiFetch(`${config.mediaServiceUrl}/api/media/${objectKey}/download-url`);
}

/** Uploads a browser File directly to MinIO via the presigned URL — never through our own servers, same as mobile. */
export async function uploadToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

export async function uploadMedia(file: File): Promise<string> {
  const { objectKey, uploadUrl } = await createUploadUrl();
  await uploadToPresignedUrl(uploadUrl, file);
  return objectKey;
}

/**
 * Cuts an already-uploaded video down to [startMs, endMs) server-side (see
 * MediaController#trimVideo — ffmpeg stream copy, no re-encode) and returns
 * the NEW object key for the trimmed result; the original upload is left
 * untouched. Same endpoint mobile's status composer uses.
 */
export function trimVideo(objectKey: string, startMs: number, endMs: number): Promise<{ objectKey: string }> {
  return apiFetch(`${config.mediaServiceUrl}/api/media/trim-video`, {
    method: 'POST',
    body: JSON.stringify({ objectKey, startMs, endMs }),
  });
}
