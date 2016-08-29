import os from 'os';

export const getHostFullUrl = (req, url) => {
  const {
    protocol,
    originalUrl
  } = req;
  const host = req.headers && req.headers.host ? req.headers.host : req.get('host');
  return `${protocol}://${host}${url || originalUrl}`;
};

export const getHostIp = () => {
  const ifaces = os.networkInterfaces();
  const addresses = [];

  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }
      addresses.push(iface.address);
    });
  });
  return addresses.length > 0 ? addresses[0] : '127.0.0.1';
};

export const getHostPort = (req) => {
  if (!req.headers || !req.headers.host) {
    return -1;
  }
  const [, port] = req.headers.host.split(':');
  return port || -1;
};

export const getClientIp = req => req.headers['x-forwarded-for'] ||
req.connection.remoteAddress ||
req.socket.remoteAddress ||
req.connection.socket.remoteAddress;
