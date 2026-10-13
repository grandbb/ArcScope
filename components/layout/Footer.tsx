import { ArrowUpRight, Code2, Mail } from "lucide-react";

export function Footer() {
  const linkClass = "inline-flex min-h-10 items-center gap-2.5 rounded-xl border border-border/70 bg-background/40 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return <footer aria-label="Developer credits" className="relative mt-4 border-t border-border/60 bg-card/35">
    <div aria-hidden="true" className="brand-gradient absolute inset-x-0 top-0 h-px opacity-35" />
    <div className="mx-auto flex max-w-[1680px] flex-col gap-5 px-4 pb-24 pt-6 md:flex-row md:items-center md:justify-between md:px-7 md:pb-6 xl:px-8">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><Code2 className="h-5 w-5" /></span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">AScope · Developer credits</p>
          <p className="mt-1 text-sm text-muted-foreground">Built by <span className="brand-text font-bold">Max Play</span></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <a href="mailto:grandmaxplay@gmail.com" className={linkClass}><Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /><span className="break-all">grandmaxplay@gmail.com</span></a>
        <a href="https://community.arc.io/home/users/max-play-4698q43lc1" target="_blank" rel="noopener noreferrer" className={linkClass}>Arc House <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-primary" /></a>
      </div>
    </div>
  </footer>;
}
