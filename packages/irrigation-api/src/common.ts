export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    requestId?: string;
    generatedAt?: string;
  };
}

export interface ApiMutationResult {
  success: boolean;
  message?: string;
}

export interface PagingQuery {
  page?: number;
  pageSize?: number;
}

export interface IdQuery {
  id: string;
}
