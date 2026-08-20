import { SafeApiError } from "../api/envelope.js";

/**
 * Read an upstream provider response without trusting Response.json().
 * Gateways occasionally return an empty body or HTML; those states must stay
 * typed all the way to the BFF instead of becoming an unclassified SyntaxError.
 */
export async function readProviderJson<T>(response: Response, provider: string): Promise<T> {
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    throw new SafeApiError("EMPTY_RESPONSE", `${provider} 未返回内容。`, 502, true);
  }
  if (!raw.trim()) throw new SafeApiError("EMPTY_RESPONSE", `${provider} 未返回内容。`, 502, true);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SafeApiError("INVALID_RESPONSE_FORMAT", `${provider} 返回格式无法识别。`, 502, true);
  }
}
