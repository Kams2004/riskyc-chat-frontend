import { useEffect, useRef, useState } from 'react';

/**
 * True once the ref'd element has entered the viewport at least once —
 * stays true after that (never re-hides on scroll-away), since the point
 * is "start loading this media", not toggling visibility. Used to gate
 * useMediaUrl resolution behind actual visibility instead of every tile in
 * a long scrolled-past message list eagerly minting a presigned URL and
 * downloading its image the moment the thread mounts.
 */
export function useInView<T extends HTMLElement>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
