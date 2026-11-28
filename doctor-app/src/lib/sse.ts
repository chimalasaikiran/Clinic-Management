export type ServerEvent = { event: string; data: string };

/**
 * Reads a Server-Sent Events body as it arrives. Chunks can split a message anywhere, so text is held
 * until the blank line that ends each message.
 */
export function createEventParser(onEvent: (event: ServerEvent) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    const messages = buffer.split(/\r?\n\r?\n/);
    buffer = messages.pop() ?? '';
    for (const message of messages) {
      let event = 'message';
      const data: string[] = [];
      for (const line of message.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      onEvent({ event, data: data.join('\n') });
    }
  };
}
