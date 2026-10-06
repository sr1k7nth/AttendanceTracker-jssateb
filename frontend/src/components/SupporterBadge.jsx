import { useEffect, useId, useRef, useState } from 'react';

// Half of the tip's max-width (240px) + gap — keeps the bubble on-screen
// when the badge sits near a viewport edge.
const HALF_MAX = 128;

// ★ supporter badge with a hover/focus tooltip.
// The tip is position: fixed and JS-placed on purpose: the leaderboard's
// rows and list use overflow: hidden, so an absolutely-positioned bubble
// anchored to the badge would be clipped. Fixed elements ignore that
// clipping (no transformed ancestors in between).
export default function SupporterBadge() {
  const badgeRef = useRef(null);
  const tipId = useId();
  // { x, y, below } while visible, null when hidden
  const [tip, setTip] = useState(null);

  const show = () => {
    const rect = badgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const center = rect.left + rect.width / 2;
    setTip({
      x: Math.min(Math.max(center, HALF_MAX + 8), window.innerWidth - HALF_MAX - 8),
      y: rect.top,
      // badge near the top edge → drop the tip below it instead
      below: rect.top < 70,
    });
  };

  const hide = () => setTip(null);

  // Fixed positioning doesn't follow the badge while the page scrolls —
  // just dismiss the tip instead of letting it drift.
  useEffect(() => {
    if (!tip) return undefined;
    const onScroll = () => setTip(null);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tip]);

  return (
    <>
      <span
        ref={badgeRef}
        className="supporter-badge"
        tabIndex={0}
        role="img"
        aria-label="Supporter"
        aria-describedby={tip ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        ★
      </span>
      {tip && (
        <span
          id={tipId}
          role="tooltip"
          className={`supporter-badge-tip${tip.below ? ' below' : ''}`}
          style={{ left: `${tip.x}px`, top: `${tip.y}px` }}
        >
          Support this project and get a badge
        </span>
      )}
    </>
  );
}
