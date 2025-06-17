export type Account = {
    id?: string;
    name: string;
    type: string;
    balance?: number;
    user?: string;
    createdAt?: string;
};

export type Expense = {
    id?: string;
    amount: number;
    date: string;
    category: string;
    description: string;
    item: string;
    accountId: string;
    user?: string;
    createdAt?: string;
};