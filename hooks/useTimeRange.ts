"use client";
import { useState } from "react";
import type { TimeRange } from "@/lib/types";
export function useTimeRange(initial: TimeRange = "30D") { const [range, setRange] = useState<TimeRange>(initial); return { range, setRange }; }
