export interface QueryResponse {
  continue?: {
    continue?: string;
    plcontinue?: string;
    gblcontinue?: string;
  };
  query: {
    pages: QueryPage[];
  };
}

export interface QueryPage {
  title: string;
  links?: { title: string }[];
}
