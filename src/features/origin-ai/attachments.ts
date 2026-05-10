import type { ChatAttachment } from '../../types';

export function normalizeAttachments(metadata?: Record<string, unknown> | null): ChatAttachment[] {
  const raw = metadata?.attachments;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      type: typeof item.type === 'string' ? item.type : 'file',
      storage: typeof item.storage === 'string' ? item.storage : undefined,
      bucket: typeof item.bucket === 'string' ? item.bucket : undefined,
      objectKey: typeof item.objectKey === 'string' ? item.objectKey : undefined,
      url: typeof item.url === 'string' ? item.url : null,
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
      sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : undefined,
      sha256: typeof item.sha256 === 'string' ? item.sha256 : undefined,
      uploadedAt: typeof item.uploadedAt === 'string' ? item.uploadedAt : undefined,
    }));
}

export function firstImageAttachmentUrl(metadata?: Record<string, unknown> | null): string | undefined {
  return normalizeAttachments(metadata).find((attachment) => (
    attachment.type === 'image' && typeof attachment.url === 'string' && attachment.url.length > 0
  ))?.url ?? undefined;
}
