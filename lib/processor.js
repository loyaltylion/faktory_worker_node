const debug = require('debug')('faktory-worker:processor');
const shuffle = require('array-shuffle');
const compose = require('koa-compose');

module.exports = class Processor {
  constructor(options = {}) {
    const { queues, middleware } = options;

    if (queues) {
      this.queues = Array.isArray(queues) ? queues : [queues];
    } else {
      this.queues = ['default'];
    }

    this.wid = options.wid;
    this.registry = options.registry || {};
    this.createDispatchWithMiddleware(middleware);
    this.withConnection = options.withConnection;
  }

  get working() {
    return !!this.current;
  }

  start() {
    return this.loop();
  }

  quiet() {
    this._quiet = true;
  }

  async stop() {
    this.quiet();
    await this.current;
  }

  async loop() {
    for (;;) {
      if (this._quiet) {
        break;
      }

      // fetch always blocks for 2s,
      // so this loop is naturally throttled
      const job = await this.fetch(...shuffle(this.queues));

      if (job) {
        // set current for sync jobs, otherwise a sync
        // job could be in-progress, but this.current
        // isn't set until that function returns
        this.current = job;
        // set current for async jobs
        this.current = this.dispatchWithMiddleware({ job });
        await this.current;
        this.current = null;
      }
    }
  }

  async dispatch(ctx, next) {
    const { job } = ctx;
    const { jobtype, jid } = job;
    const fn = this.registry[jobtype];

    debug(`DISPATCH: ${JSON.stringify(job)}`);

    if (!fn) {
      const err = new Error(`No jobtype registered for: ${jobtype}`);
      console.error(err);
      await this.fail(jid, err);
      return next();
    }

    ctx.fn = fn;

    return next();
    // return this.execute(fn, job);
  }

  async execute({ job, fn }, next) {
    const { jid, args } = job;

    // @TODO keep in-progress queue to FAIL those jobs during shutdown
    try {
      const thunk = await fn(...args);
      // jobfn returns a function to accept the job payload
      // ex: (...args) => (job) => { ... }
      if (typeof thunk === 'function') {
        await thunk(job);
      }
      await this.ack(jid);
    } catch (e) {
      const error = wrapAndWarnIfNotError(e);
      await this.fail(jid, error);
      console.error(error);
    }
    return next();
  }

  createDispatchWithMiddleware(fns = []) {
    this.dispatchWithMiddleware = compose(
      fns.concat([
        this.dispatch.bind(this),
        this.execute.bind(this)
      ])
    );
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  fetch(...args) {
    return this.withConnection(c => c.fetch(...args));
  }

  ack(...args) {
    return this.withConnection(c => c.ack(...args));
  }

  fail(...args) {
    return this.withConnection(c => c.fail(...args));
  }

  log(msg) {
    console.log(`${new Date().toJSON()} wid=${this.wid} pid=${process.pid} ${msg}`);
  }
};

function wrapAndWarnIfNotError(error) {
  if (error instanceof Error) {
    return error;
  } else {
    console.warn(`
Job failed without providing an error.
Ensure your promise was rejected with an error and not a string
reject(new Error('message')) vs. reject('message')
    `);
    return new Error(error || 'Job failed with no error or message given');
  }
}
