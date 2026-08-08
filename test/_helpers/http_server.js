import http from 'http';

/**
 * Start a local HTTP server for integration tests.
 * Responses are consumed from a FIFO queue, each entry shaped like
 * `{ statusCode, body, headers }`.
 * @returns {Promise<{baseUrl: string, queue: Array, close: function}>}
 */
export const createTestServer = () => new Promise((resolve) => {
  const queue = [];
  const server = http.createServer((req, res) => {
    const next = queue.shift() || {};
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
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      queue,
      close: () => new Promise((res) => server.close(res))
    });
  });
});
