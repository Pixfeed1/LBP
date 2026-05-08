export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  link: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}
