export type Party = 'republican' | 'democratic';

export interface Politician {
  name: string;
  party: Party;
}

export interface Edge {
  from: string;
  to: string;
}
