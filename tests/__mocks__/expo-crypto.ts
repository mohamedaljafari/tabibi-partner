import { createHash, randomBytes, pbkdf2 as nodePbkdf2 } from "crypto";
import { promisify } from "util";

const pbkdf2Promise = promisify(nodePbkdf2);

export enum CryptoDigestAlgorithm {
  SHA1 = "SHA-1",
  SHA256 = "SHA-256",
  SHA384 = "SHA-384",
  SHA512 = "SHA-512",
  MD2 = "MD2",
  MD4 = "MD4",
  MD5 = "MD5",
}

export enum CryptoEncoding {
  HEX = "hex",
  BASE64 = "base64",
}

export type CryptoDigestOptions = { encoding?: CryptoEncoding };

export async function digestStringAsync(algorithm: string, data: string, options: CryptoDigestOptions = {}): Promise<string> {
  const hash = createHash(algorithm === "SHA-256" ? "sha256" : "sha1").update(data, "utf8");
  return options.encoding === CryptoEncoding.BASE64 ? hash.digest("base64") : hash.digest("hex");
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(byteCount));
}

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(randomBytes(byteCount));
}

export type CryptoPbkdf2Options = { encoding?: CryptoEncoding };

export async function pbkdf2Async(
  password: string,
  salt: string,
  iterations: number,
  keyLength: number,
  algorithm: string,
  options: CryptoPbkdf2Options = {},
): Promise<string> {
  const digest = algorithm === "SHA-256" ? "sha256" : algorithm === "SHA-512" ? "sha512" : "sha1";
  const result = await pbkdf2Promise(password, salt, iterations, keyLength, digest);
  return options.encoding === CryptoEncoding.BASE64 ? result.toString("base64") : result.toString("hex");
}

export function getRandomValues(array: Uint8Array): Uint8Array {
  const values = randomBytes(array.length);
  for (let index = 0; index < array.length; index++) {
    array[index] = values[index];
  }
  return array;
}
