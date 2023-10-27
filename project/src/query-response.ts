export interface QueryResponse {
  continue?: {
    continue?: string;
    plcontinue?: string;
    blcontinue?: string;
    gblcontinue?: string;
  };
  query: {
    pages: QueryPage[];
    backlinks: QueryPage[];
  };
}

export interface QueryPage {
  title: string;
  links?: { title: string }[];
}
