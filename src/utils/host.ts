import os from 'os';
import type { Request } from 'express';

/**
 * getHostFullUrl 只读取 protocol/originalUrl/headers.host/get；
 * 用最小结构类型兼容真实 express Request 与测试用的 duck-typed mock
 */
type HostUrlRequest = {
  protocol: string;
  originalUrl: string;
  headers?: { host?: string | undefined };
  get(name: string): string | undefined;
};

export const getHostFullUrl = (req: HostUrlRequest, url?: string): string => {
  const {
    protocol,
    originalUrl
  } = req;
  const host = req.headers && req.headers.host ? req.headers.host : req.get('host');
  return `${protocol}://${host}${url || originalUrl}`;
};

export const getHostIp = (): string => {
  const ifaces = os.networkInterfaces();
  const addresses: string[] = [];

  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname]!.forEach((iface) => {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }
      addresses.push(iface.address);
    });
  });
  return addresses.length > 0 ? addresses[0] : '127.0.0.1';
};

export const getHostPort = (req: Request): number | string => {
  if (!req.headers || !req.headers.host) {
    return -1;
  }
  const [, port] = req.headers.host.split(':');
  return port || -1;
};

export const getClientIp = (req: Request): string | undefined =>
(req.headers['x-forwarded-for'] as string | undefined) ||
req.connection.remoteAddress ||
req.socket.remoteAddress ||
// 原实现访问 connection.socket（Socket 上不存在该属性），不可达时按原样抛 TypeError，不做可选链
(req.connection as unknown as { socket: { remoteAddress?: string } }).socket.remoteAddress;
