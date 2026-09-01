"use client";
import { Share2 } from "lucide-react"; import { Button } from "@/components/ui/button";
export function ShareButton() { const share = async () => { if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else await navigator.clipboard.writeText(location.href); }; return <Button variant="outline" onClick={share}><Share2/>Share</Button>; }
