import http from 'http';
import type { AddressInfo } from 'net';

/**
 * Queue entry consumed by the test server, shaped like `{ statusCode, body, headers }`.
 */
export interface QueuedResponse {
  statusCode?: number;
  body?: string | object;
  headers?: http.OutgoingHttpHeaders;
}

/**
 * Handle returned by {@link createTestServer}.
 */
export interface TestServer {
  baseUrl: string;
  queue: QueuedResponse[];
  close: () => Promise<unknown>;
}

/**
 * Start a local HTTP server for integration tests.
 * Responses are consumed from a FIFO queue, each entry shaped like
 * `{ statusCode, body, headers }`.
 * @returns {Promise<{baseUrl: string, queue: Array, close: function}>}
 */
export const createTestServer = () => new Promise<TestServer>((resolve) => {
  const queue: QueuedResponse[] = [];
  const server = http.createServer((req, res) => {
    const next: QueuedResponse = queue.shift() || {};
    const {
      statusCode = 200,
      body = '',
      headers = {}
    } = next;
    res.writeHead(statusCode, headers);
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  server.listen(0, '127.0.0.1', () => {
    resolve({
      // listen(host, port) 回调触发时 address() 必为 AddressInfo
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      queue,
      close: () => new Promise((res) => server.close(res))
    });
  });
});
