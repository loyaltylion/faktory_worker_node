import { expectType } from "tsd-check";
import faktory, { FaktoryWorker } from ".";

async function tests() {
  // pushing jobs
  const client = await faktory.connect();

  expectType<FaktoryWorker.Client>(client);
  expectType<FaktoryWorker.Job>(
    await client.job("ResizeImage", { id: 333, size: "thumb" })
  );

  const job = await client.job("ResizeImage", { id: 333, size: "thumb" });

  const ctx = { job };

  expectType<void>(await client.close());

  // processing jobs
  expectType<typeof faktory>(
    faktory.register("ResizeImage", async ({ id, size }) => {
      // stuff
    })
  );

  await faktory.work();

  // middleware
  faktory.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.job.jobtype} took ${ms}ms`);
  });

  await faktory.work();

  // worker options

  faktory.work({
    // default: 127.0.0.1 -- can be set in FAKTORY_URL env (see FAQ)
    host: "127.0.0.1",

    // default: 7419 -- can be set in FAKTORY_URL env
    port: 7419,

    // can be set in FAKTORY_URL env
    password: "s33kr3t",

    // default: 20, this is a max number of jobs the worker will have
    // in progress at any time
    concurrency: 5,

    // default: ['default'] the queues the worker will process
    queues: ["critical", "default", "eventually"],

    // default: 8000 the number of milliseconds jobs have to complete after
    // receiving a shutdown signal before the job is aborted and the worker
    // shuts down abruptly
    timeout: 25 * 1000,

    // default: uuid().first(8) the worker id to use in the faktory-server connection
    // for this process. must be unique per process
    wid: "alpha-worker",

    // default: [] labels for the faktory worker process to see in the UI
    labels: []
  });
}
