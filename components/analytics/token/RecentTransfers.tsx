import { TransactionList } from "@/components/portfolio/TransactionList";
import type { Transaction } from "@/lib/types";
export function RecentTransfers({transactions}: {transactions:Transaction[]}) {return <TransactionList transactions={transactions}/>;}
