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

const MAX_BODY_LENGTH = parseInt(process.env.MAX_REQUEST_DEBUG_BODY, 10) || 3000;
const TOO_LONG_BODY = '____TLDR____';

let debugId = 0;

const toPlainHeaders = (headers = {}) => {
  const result = {};
  Object.entries(headers).forEach(([key, value]) => {
    result[key] = String(value);
  });
  return result;
};

const buildQueryString = (qs) => {
  if (qs === undefined || qs === null) {
    return '';
  }
  if (typeof qs === 'string') {
    return qs.startsWith('?') ? qs : `?${qs}`;
  }
  return `?${new URLSearchParams(qs).toString()}`;
};

const buildBody = (params) => {
  if (params.formData) {
    const form = new FormData();
    Object.entries(params.formData).forEach(([key, value]) => {
      form.append(key, value);
    });
    return { body: form, contentType: null };
  }
  if (params.form) {
    return {
      body: new URLSearchParams(params.form).toString(),
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
  return { body: params.body, contentType: null };
};

const truncateBody = (body) => {
  if (typeof body !== 'string') {
    return body ? String(body) : '';
  }
  return body.length > MAX_BODY_LENGTH ? TOO_LONG_BODY : body;
};

/**
 * Create a request-promise-native compatible callable client.
 * @param {Logger} [logger] when given, verbose request/response logs are emitted
 * @returns {function}
 */
export const createRequestClient = (logger) => {
  const request = (params = {}) => new Promise((resolve, reject) => {
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

    const requestForDump = {
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
        ? new URLSearchParams(params.formData).toString()
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
      let parsedBody = rawBody;
      if (params.json !== undefined && params.json !== false) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }

      const responseForDump = {
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
        const error = new Error(`Response status ${response.status}`);
        error.name = 'StatusCodeError';
        error.statusCode = response.status;
        error.response = responseForDump;
        error.request = requestForDump;
        reject(error);
        return;
      }

      resolve(resolveWithFullResponse ? responseForDump : parsedBody);
    }).catch((err) => {
      if (timer) {
        clearTimeout(timer);
      }
      const error = new Error(err.message);
      error.name = 'RequestError';
      error.request = requestForDump;
      reject(error);
    });
  });

  return request;
};
