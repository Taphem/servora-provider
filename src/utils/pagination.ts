export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function buildPage<T>(data: T[], page: number, pageSize: number, total: number): Page<T> {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export function paginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
