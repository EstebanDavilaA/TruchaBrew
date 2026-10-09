import type { RecipeSummary, RecipeWriteInput, StoredRecipe } from '@truchabrew/shared-types';

export class TruchaBrewApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'TruchaBrewApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class TruchaBrewConnectionError extends Error {
  readonly baseUrl: string;
  readonly cause?: unknown;

  constructor(baseUrl: string, cause?: unknown) {
    super(`Could not connect to TruchaBrew API at ${baseUrl}. Ensure TruchaBrew is running.`);
    this.name = 'TruchaBrewConnectionError';
    this.baseUrl = baseUrl;
    this.cause = cause;
  }
}

export function getTruchaBrewApiUrl(): string {
  return process.env.TRUCHABREW_API_URL || 'http://localhost:3000';
}

export interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class TruchaBrewClient {
  readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(options?: ClientOptions) {
    const rawUrl = options?.baseUrl ?? getTruchaBrewApiUrl();
    this.baseUrl = rawUrl.replace(/\/+$/, '');
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    const targetUrl = `${this.baseUrl}${fullPath}`;

    let response: Response;
    try {
      response = await this.fetchFn(targetUrl, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    } catch (err: unknown) {
      throw new TruchaBrewConnectionError(this.baseUrl, err);
    }

    if (!response.ok) {
      let code = `HTTP_${response.status}`;
      let message = `API request failed with status ${response.status} (${response.statusText})`;
      let details: unknown;

      try {
        const body = (await response.json()) as unknown;
        if (body && typeof body === 'object') {
          if ('error' in body && typeof body.error === 'object' && body.error !== null) {
            const errObj = body.error as { code?: string; message?: string; details?: unknown };
            if (errObj.code) code = errObj.code;
            if (errObj.message) message = errObj.message;
            if (errObj.details !== undefined) details = errObj.details;
          } else if ('message' in body && typeof body.message === 'string') {
            message = body.message;
            if ('code' in body && typeof body.code === 'string') {
              code = body.code;
            } else if ('error' in body && typeof body.error === 'string') {
              code = body.error;
            }
          }
        }
      } catch {
        // Response body was not JSON; use default message
      }

      throw new TruchaBrewApiError(response.status, code, message, details);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  async listRecipes(params?: { q?: string; folder?: string | null; tag?: string | null }): Promise<RecipeSummary[]> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.folder !== undefined && params?.folder !== null && params.folder !== '') {
      searchParams.set('folder', params.folder);
    }
    if (params?.tag) searchParams.set('tag', params.tag);

    const qs = searchParams.toString();
    const path = `/api/recipes${qs ? `?${qs}` : ''}`;
    return this.request<RecipeSummary[]>(path);
  }

  async getRecipe(id: string): Promise<StoredRecipe> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Recipe id must be a non-empty string');
    }
    return this.request<StoredRecipe>(`/api/recipes/${encodeURIComponent(id.trim())}`);
  }

  async updateRecipe(id: string, recipe: RecipeWriteInput): Promise<StoredRecipe> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('Recipe id must be a non-empty string');
    }
    return this.request<StoredRecipe>(`/api/recipes/${encodeURIComponent(id.trim())}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  }
}
