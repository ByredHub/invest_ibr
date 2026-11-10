export function Hint({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <span tabIndex={0} className="group relative inline-flex cursor-help align-middle">
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] font-semibold leading-none ${
          dark ? "border-white/25 text-white/50" : "border-line text-muted"
        }`}
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-56 rounded-ctl bg-ink px-3.5 py-2.5 text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  );
}
