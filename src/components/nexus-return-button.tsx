/**
 * The way back to the member's dashboard on Cyberdelic Nexus: the Nexus mark as a round
 * button, the same size as the navbar's other round buttons. Shown only to members who came
 * from the platform (useNexusReturnLink gives null otherwise).
 */
export function NexusReturnButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      title="Back to Cyberdelic Nexus"
      aria-label="Back to Cyberdelic Nexus"
      className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] active:scale-95 transition-all"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
      <img src="/brand/nexus-mark.svg" alt="" width={38} height={38} className="w-[38px] h-[38px] rounded-full" />
    </a>
  );
}
