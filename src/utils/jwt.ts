import crypto from 'node:crypto';

/**
 * jwt-simple 的内联替代：与 jwt-simple 0.5.6 保持相同的行为面，包括
 * 由 token header 的 alg 决定验证算法、nbf/exp 秒级时间戳检查和错误消息；
 * 唯一的差异是 HMAC 签名比较使用 timingSafeEqual（结果语义不变）。
 * RS256 仅支持验证，与 jwt-simple 相同。
 */

const algorithmMap = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
  RS256: 'RSA-SHA256'
} as const;

const typeMap = {
  HS256: 'hmac',
  HS384: 'hmac',
  HS512: 'hmac',
  RS256: 'sign'
} as const;

type Algorithm = keyof typeof algorithmMap;
type SigningMethod = (typeof algorithmMap)[Algorithm];
type SigningType = (typeof typeMap)[Algorithm];

export function encode(payload: object, key: string, algorithm: Algorithm = 'HS256'): string {
  if (!key) {
    throw new Error('Require key');
  }

  const signingMethod = algorithmMap[algorithm];
  const signingType = typeMap[algorithm];
  if (!signingMethod || !signingType) {
    throw new Error('Algorithm not supported');
  }

  // header 键序固定为 typ, alg，保证对相同 payload/key 生成的 token 与 jwt-simple 字节一致
  const header = { typ: 'JWT', alg: algorithm };
  const segments = [
    base64urlEncode(JSON.stringify(header)),
    base64urlEncode(JSON.stringify(payload))
  ];
  segments.push(sign(segments.join('.'), key, signingMethod, signingType));

  return segments.join('.');
}

export function decode(token: string, key: string): object {
  // check token
  if (!token) {
    throw new Error('No token supplied');
  }
  // check segments
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Not enough or too many segments');
  }

  const [headerSeg, payloadSeg, signatureSeg] = segments;
  const header = JSON.parse(base64urlDecode(headerSeg)) as { alg?: Algorithm };
  const payload = JSON.parse(base64urlDecode(payloadSeg)) as { nbf?: number; exp?: number };

  // 与 jwt-simple 一致：PEM 公钥按 RS256 验证，否则以 header.alg 决定验证算法
  const algorithm: Algorithm | undefined =
    /BEGIN( RSA)? PUBLIC KEY/.test(String(key)) ? 'RS256' : header.alg;
  const signingMethod = algorithm ? algorithmMap[algorithm] : undefined;
  const signingType = algorithm ? typeMap[algorithm] : undefined;
  if (!signingMethod || !signingType) {
    throw new Error('Algorithm not supported');
  }

  // verify signature
  const signingInput = `${headerSeg}.${payloadSeg}`;
  if (!verify(signingInput, key, signingMethod, signingType, signatureSeg)) {
    throw new Error('Signature verification failed');
  }

  // Support for nbf and exp claims.
  // According to the RFC, they should be in seconds.
  if (payload.nbf && Date.now() < payload.nbf * 1000) {
    throw new Error('Token not yet active');
  }

  if (payload.exp && Date.now() > payload.exp * 1000) {
    throw new Error('Token expired');
  }

  return payload;
}

function sign(input: string, key: string, method: SigningMethod, type: SigningType): string {
  if (type === 'hmac') {
    return crypto.createHmac(method, key).update(input).digest('base64url');
  }
  return crypto.createSign(method).update(input).sign(key, 'base64url');
}

function verify(input: string, key: string, method: SigningMethod, type: SigningType, signature: string): boolean {
  if (type === 'hmac') {
    const expected = Buffer.from(sign(input, key, method, type));
    const provided = Buffer.from(signature);
    return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  }
  return crypto.createVerify(method).update(input).verify(key, signature, 'base64url');
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}
