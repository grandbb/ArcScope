"use client";
import { Check, Copy } from "lucide-react"; import { useState } from "react"; import { Button } from "@/components/ui/button";
export function CopyButton({ value }: { value: string }) { const [copied, setCopied] = useState(false); const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }; return <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy to clipboard">{copied ? <Check className="text-emerald-500"/> : <Copy/>}</Button>; }
