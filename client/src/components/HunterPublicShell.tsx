import React, { type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import "@/styles/hunter-harness.css";
export function HunterPublicShell({ children }: { children: ReactNode }) {
  return <div className="hunter-public"><header className="hunter-public-bar"><Link href="/"><ArrowUpRight aria-hidden="true" />Signal Hunter</Link><nav aria-label="Public navigation"><Link href="/walkthrough">Try a case</Link><Link href="/sign-in">Sign in</Link></nav></header>{children}<footer className="hunter-public-main text-xs border-t border-rule"><p>Signal Hunter · Decision support, not an investment recommendation. Examples are illustrative; the operator decides.</p><div className="flex flex-wrap gap-x-6 mt-3"><Link href="/pricing" className="underline">Launch pricing</Link><Link href="/jims-file" className="underline" aria-label="Jim’s file — illustrative business idea case">Jim’s file ↗</Link></div></footer></div>;
}
