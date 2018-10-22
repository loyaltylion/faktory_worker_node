type FaktoryWorkerError = unknown;
export namespace FaktoryWorker {
  interface JobPayload {
    readonly jobtype: string;
    readonly queue?: string;
    readonly at?: Date;
    readonly args: ReadonlyArray<unknown>;
  }

  interface WorkerOptions {
    readonly wid?: string;
    readonly concurrency?: number;
    readonly timeout?: number;
    readonly beatInterval?: number;
    readonly queues?: ReadonlyArray<string>;
    readonly middleware?: Middleware;
    readonly registry?: ReadonlyArray<{ [key: string]: GenericFunction }>;
    readonly processors?: unknown;
  }

  interface ClientOptions {
    readonly url?: string;
    readonly password?: string;
    readonly labels?: ReadonlyArray<string>;
    readonly wid?: string;
    readonly reconnectDelay?: number;
    readonly reconnect?: boolean;
    readonly host?: string;
    readonly port?: string;
  }

  class Client {
    constructor(options: ClientOptions);

    static checkVersion(version: number): void;

    static parse(data: unknown): { text?: string; payload?: unknown };

    static hash(pwd: string, salt: string, iterations: number): string;

    job(jobtype: string, ...args: unknown[]): Job;

    static encode(command: ReadonlyArray<unknown>): string;

    connect(): Promise<void>;

    listenToSocket(): Client;

    createParser(): unknown; // typeof node-redis-parser

    handShake(): Promise<void>;

    buildHello(opts: {
      readonly s: string;
      readonly i: number;
    }): { readonly hostname: string; readonly v: number };

    send(
      command: string,
      expectation: string
    ): { readonly text: string; readonly payload?: unknown };

    receive(
      data: unknown
    ): (err: FaktoryWorkerError, response: unknown) => unknown;

    receiveError(err: FaktoryWorkerError): void;

    fetch(...queues: string[]): Promise<unknown>;

    beat(): Promise<string | unknown>;

    push(job: JobPayload): Promise<string>;

    flush(): Promise<string>;

    info(): Promise<unknown>;

    ack(jid: string): Promise<string>;

    fail(jid: string, e: unknown): Promise<string>;

    close(): void;

    createSocket(): void;

    onConnect(): Promise<void>;

    onClose(): void;

    onError(err: FaktoryWorkerError): void;

    clearReplyQueue(err: FaktoryWorkerError): void;
  }

  class Job {
    readonly payload: JobPayload;
    constructor(jobtype: string);

    static defaults(): {
      readonly jid: string;
      readonly queue: string;
      readonly args: ReadonlyArray<unknown>;
      readonly priority: number;
      readonly retry: number;
    };

    client(client: Client): Job;

    args(...args: unknown[]): Job;

    at(time: Date): Job;

    custom(data: unknown): Job;

    reserveFor(seconds: number): Job;

    queue(name: string): Job;

    priority(num: number | string): Job;

    toJSON(): JobPayload;

    push(): Promise<string>;
  }

  class Worker {
    /** Returns list of jobs in progress */
    readonly inProgress: unknown;

    constructor(options: WorkerOptions);

    tick(pid: string): Promise<void>;

    work(): Promise<Worker>;

    setTick(pid: string): void;

    quiet(): void;

    stop(): Promise<void>;

    closePool(): Promise<void>;

    beat(): Promise<void>;

    fetch(): Promise<Client>;

    createExecutionStack(): unknown;

    handle(job: Job): Promise<void>;

    trapSignals(): void;

    static removeSignalHandlers(): void;
  }
}

type Middleware = (
  ctx: {
    readonly job: FaktoryWorker.JobPayload;
  },
  next: () => Promise<unknown>
) => Promise<unknown>;

type GenericFunction = (...arguments: unknown[]) => unknown;

interface Faktory {
  registry: ReadonlyArray<{ [key: string]: GenericFunction }>;
  middleware: ReadonlyArray<Middleware>;
  use(middleware: Middleware): Faktory;
  register: (name: string, GenericFunction) => Faktory;
  connect: () => Promise<FaktoryWorker.Client>;
  work: (options?: unknown) => Promise<FaktoryWorker.Worker>;
  stop: () => void;
}

declare const faktory: Faktory;

export default faktory;
