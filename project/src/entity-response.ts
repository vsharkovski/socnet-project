export interface EntityResponse {
  entities: { [id: string]: Entity };
}

export interface Entity {
  id: string;
  labels: {
    [language: string]: { language: string; value: string };
  };
  claims: {
    [propertyId: string]: {
      mainsnak: { datavalue: { value: { id: string } } };
    }[];
  };
}
