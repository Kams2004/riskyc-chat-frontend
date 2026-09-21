import { useMediaUrl } from '../features/media/useMediaUrl';

/** Ported from mobile's MessageFile — single generic document icon, filename, tap opens the presigned URL in a new tab. */
export function FileAttachmentRow({ objectKey, fileName }: { objectKey: string; fileName: string | null | undefined }) {
  const url = useMediaUrl(objectKey);
  return (
    <a
      className="file-attachment-row"
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
    >
      <span className="file-attachment-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </span>
      <span className="file-attachment-name">{fileName || 'Document'}</span>
    </a>
  );
}
