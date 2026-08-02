/**
 * The page's background texture: a fine dot grid plus one soft accent wash
 * bleeding down from behind the hero card, so the light page and the dark card
 * read as one surface rather than a card dropped onto blank paper.
 *
 * Fixed rather than in-flow, so it costs no layout and stays put under the
 * report page's `h-dvh overflow-hidden` scroll lock. It sits at z-0; the shell
 * above it is `relative z-10`.
 */
export default function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="dot-grid absolute inset-0" />
      {/* Carries the hero's green onto the paper. Sits low rather than at the
          top: behind the hero card it would be invisible, and the paper below
          is what needs lifting. Wide and very blurred, so it reads as ambient
          light rather than a shape. */}
      <div className="absolute left-1/2 top-[55vh] h-[40rem] w-[80rem] -translate-x-1/2 rounded-full bg-accent/12 blur-[150px]" />
    </div>
  );
}
