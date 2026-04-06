export async function parseDraftResponse<T extends { error?: string }>(
  response: Response,
  fallbackErrorMessage: string
): Promise<T> {
  const rawResponse = await response.text();
  const trimmedResponse = rawResponse.trim();

  if (!trimmedResponse) {
    throw new Error(
      response.ok
        ? "The server returned an empty draft response."
        : `${fallbackErrorMessage} The server returned an empty error response.`
    );
  }

  let payload: T;

  try {
    payload = JSON.parse(trimmedResponse) as T;
  } catch {
    if (!response.ok) {
      const plainText = trimmedResponse.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const messageSuffix = plainText
        ? ` Server response: ${plainText.slice(0, 220)}`
        : "";

      throw new Error(`${fallbackErrorMessage}${messageSuffix}`);
    }

    throw new Error(
      "The server returned an unreadable draft response."
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || fallbackErrorMessage);
  }

  return payload;
}
