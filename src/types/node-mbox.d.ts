declare module "node-mbox" {
  import { Readable } from "stream";

  interface MboxOptions {
    encoding?: string;
  }

  class Mbox {
    constructor(filename: string, options?: MboxOptions);
    constructor(stream: Readable, options?: MboxOptions);
    on(event: "message", listener: (msg: Buffer) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "end", listener: () => void): this;
  }

  export { Mbox };
}
