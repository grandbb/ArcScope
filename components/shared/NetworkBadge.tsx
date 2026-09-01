import { Badge } from "@/components/ui/badge"; import { getChain } from "@/lib/chains";
export function NetworkBadge({ chain = "arc" }: { chain?: string }) { const config = getChain(chain); return <Badge variant="outline"><i className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: config.color }}/>{config.name}</Badge>; }
