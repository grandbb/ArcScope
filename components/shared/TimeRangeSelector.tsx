"use client";
import type { TimeRange } from "@/lib/types"; import { Button } from "@/components/ui/button";
export function TimeRangeSelector({ value, onChange, options = ["7D", "30D", "90D", "1Y"] }: { value: TimeRange; onChange: (range: TimeRange) => void; options?: TimeRange[] }) { return <div className="inline-flex rounded-lg bg-muted p-1">{options.map((option) => <Button key={option} size="sm" variant={value === option ? "secondary" : "ghost"} onClick={() => onChange(option)} className="h-7 px-2.5 text-xs">{option}</Button>)}</div>; }
