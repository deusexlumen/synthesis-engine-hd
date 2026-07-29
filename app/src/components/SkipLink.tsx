/**
 * Skip link for keyboard users — jumps straight to the main content.
 */
export function SkipLink({ targetId, children = 'Zum Hauptinhalt springen' }: { targetId: string; children?: React.ReactNode }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black focus:rounded-lg"
    >
      {children}
    </a>
  );
}
