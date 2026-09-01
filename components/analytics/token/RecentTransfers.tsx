import { mockTransactions } from "@/lib/mock-data"; import { TransactionList } from "@/components/portfolio/TransactionList";
export function RecentTransfers() { return <TransactionList transactions={mockTransactions.slice(0,8)}/>; }
