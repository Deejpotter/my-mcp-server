declare module "mailparser" {
  interface AddressObject {
    text?: string;
    value?: Array<{ name?: string; address?: string }>;
  }

  interface ParsedMail {
    subject?: string;
    from?: AddressObject;
    to?: AddressObject;
    date?: Date;
    messageId?: string | undefined;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename?: string;
      contentType?: string;
      content?: Buffer;
    }>;
  }

  export function simpleParser(source: Buffer | string, options?: any): Promise<ParsedMail>;
}
