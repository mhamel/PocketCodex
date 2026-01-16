const DA_RESPONSE_RE = /(?:\x1b\[|\[)(?:\?|>)[0-9;]*c/g;

export function stripTerminalIdentityResponses(text: string): string {
  return text.replace(DA_RESPONSE_RE, '');
}
