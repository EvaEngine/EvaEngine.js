/**
 * A request-promise-native compatible HTTP client built on the global fetch.
 *
 * Keeps the option object and error shape used by the legacy `request`
 * ecosystem so callers of HttpClient/RestClient see no interface change:
 * - resolves with the response body (or the full response with
 *   `resolveWithFullResponse`)
 * - rejects with an error carrying `.name` (`StatusCodeError`/`RequestError`),
 *   `.statusCode`, `.response` and `.request`
 * - supports `url`, `method`, `headers`, `body`, `json`, `qs`, `form`,
 *   `formData`, `simple`, `resolveWithFullResponse` and `timeout`
 */

import type { BodyInit } from 'undici-types';

// params 的取值由调用方（HttpClient/RestClient）决定，body/json/qs 等运行时可为任意类型
type RequestClientParams = {
  url?: string;
  method?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  json?: unknown;
  qs?: Record<string, unknown> | string;
  form?: Record<string, unknown>;
  formData?: Record<string, unknown>;
  simple?: boolean;
  resolveWithFullResponse?: boolean;
  timeout?: number;
};

// 兼容旧 request 生态的错误形状
type RequestClientError = Error & {
  statusCode?: number;
  response?: unknown;
  request?: unknown;
};

// 请求/响应 dump 的结构由本文件构造，这里只声明被类型引用的部分
type RequestForDump = {
  method: string;
  uri: {
    protocol: string;
    href: string;
  };
  headers: Record<string, string>;
  req: Record<string, unknown>;
  _json: boolean;
  formData: Record<string, unknown> | null;
  body: unknown;
};

type ResponseForDump = {
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string>;
  body: unknown;
  request: RequestForDump;
};

const MAX_BODY_LENGTH = parseInt(process.env.MAX_REQUEST_DEBUG_BODY as string, 10) || 3000;
const TOO_LONG_BODY = '____TLDR____';

let debugId = 0;

const toPlainHeaders = (headers: Record<string, unknown> = {}): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    result[key] = String(value);
  });
  return result;
};

const buildQueryString = (qs?: Record<string, unknown> | string): string => {  if (qs === undefined || qs === null) {
    return '';
  }
  if (typeof qs === 'string') {
    return qs.startsWith('?') ? qs : `?${qs}`;
  }
  return `?${new URLSearchParams(qs as Record<string, string>).toString()}`;
};

const buildBody = (params: RequestClientParams): { body: BodyInit | undefined; contentType: string | null } => {
  if (params.formData) {
    const form = new FormData();
    Object.entries(params.formData).forEach(([key, value]) => {
      // FormData.append 运行时按 WebIDL 语义转换非字符串值，断言仅满足编译
      form.append(key, value as string | Blob);
    });
    return { body: form, contentType: null };
  }
  if (params.form) {
    return {
      body: new URLSearchParams(params.form as Record<string, string>).toString(),
      contentType: 'application/x-www-form-urlencoded'
    };
  }
  //The legacy `json` option also accepts a value used as the JSON body
  if (params.json !== undefined && params.json !== false && params.json !== true) {
    return { body: JSON.stringify(params.json), contentType: 'application/json' };
  }
  if (params.json === true && params.body !== undefined) {
    return { body: JSON.stringify(params.body), contentType: 'application/json' };
  }
  return { body: params.body as BodyInit | undefined, contentType: null };
};

const truncateBody = (body: unknown): string => {
  if (typeof body !== 'string') {
    return body ? String(body) : '';
  }
  return body.length > MAX_BODY_LENGTH ? TOO_LONG_BODY : body;
};

/**
 * Create a request-promise-native compatible callable client.
 * @param [logger] when given, verbose request/response logs are emitted
 */
export const createRequestClient = (logger?: { verbose: (message: string, ...args: unknown[]) => void } | null) => {
  const request = (params: RequestClientParams = {}): Promise<unknown> => new Promise((resolve, reject) => {
    const {
      url,
      method: rawMethod = 'GET',
      headers = {},
      resolveWithFullResponse = false,
      simple = true,
      timeout = 0,
      qs
    } = params;

    const method = String(rawMethod).toUpperCase();
    const targetUrl = `${url}${buildQueryString(qs)}`;
    const { body, contentType } = buildBody(params);

    const requestHeaders = toPlainHeaders(headers);
    if (contentType
      && !Object.keys(requestHeaders).some(key => key.toLowerCase() === 'content-type')) {
      requestHeaders['Content-Type'] = contentType;
    }

    const abortController = new AbortController();
    const timer = timeout > 0
      ? setTimeout(() => abortController.abort(new Error('Request timed out')), timeout)
      : null;

    const requestForDump: RequestForDump = {
      method,
      uri: {
        protocol: new URL(targetUrl).protocol,
        href: targetUrl
      },
      headers: requestHeaders,
      req: {},
      _json: params.json !== undefined && params.json !== false
        ? true : body !== undefined,
      formData: params.formData || null,
      body: params.formData
        ? new URLSearchParams(params.formData as Record<string, string>).toString()
        : body
    };

    const id = ++debugId;
    if (logger) {
      logger.verbose('[HTTP_REQUEST_%s] [%s %s] [REQ_HEADERS: %s] [REQ_BODY: %s]', id,
        method, targetUrl, JSON.stringify(requestHeaders), truncateBody(body));
    }

    fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body,
      signal: abortController.signal,
      redirect: 'follow'
    }).then(async (response) => {
      if (timer) {
        clearTimeout(timer);
      }
      const rawBody = await response.text();
      let parsedBody: unknown = rawBody;
      if (params.json !== undefined && params.json !== false) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }

      const responseForDump: ResponseForDump = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: toPlainHeaders(Object.fromEntries(response.headers.entries())),
        body: parsedBody,
        request: requestForDump
      };

      if (logger) {
        logger.verbose('[HTTP_RESPONSE_%s] [%s %s] [%s] [RES_HEADERS: %s] [RES_BODY: %s]', id,
          method, targetUrl, response.status, JSON.stringify(responseForDump.headers),
          truncateBody(parsedBody));
      }

      if (response.status >= 400 && simple) {
        const error = new Error(`Response status ${response.status}`) as RequestClientError;
        error.name = 'StatusCodeError';
        error.statusCode = response.status;
        error.response = responseForDump;
        error.request = requestForDump;
        reject(error);
        return;
      }

      resolve(resolveWithFullResponse ? responseForDump : parsedBody);
    }).catch((err: unknown) => {
      if (timer) {
        clearTimeout(timer);
      }
      // 与原实现一致：非 Error 值时 err.message 为 undefined，new Error(undefined) 的语义保持不变
      const error = new Error((err as Error).message) as RequestClientError;
      error.name = 'RequestError';
      error.request = requestForDump;
      reject(error);
    });
  });

  return request;
};
