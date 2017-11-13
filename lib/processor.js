const debug = require('debug')('faktory-worker:processor');
const shuffle = require('./shuffle');

module.exports = class Processor {
  constructor(options = {}) {
    const { queues } = options;

    if (queues) {
      this.queues = Array.isArray(queues) ? queues : [queues];
    } else {
      this.queues = ['default'];
    }

    this.wid = options.wid;
    this.id = options.id;
    this.registry = options.registry || {};
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
    this.log('Stop');
    this.quiet();
    await this.current;
  }

  async loop() {
    for (;;) {
      if (this._quiet) {
        return;
      }

      // fetch blocks for 2s when queues are empty,
      // so this loop is naturally throttled
      this.debug(`FETCH ${this.queues.join(',')}`);
      const job = await this.fetch(...shuffle(this.queues));

      if (job) {
        // set current for sync jobs, otherwise a sync
        // job could be in-progress, but this.current
        // isn't set until that function returns
        this.current = job;
        // set current for async jobs
        this.current = this.dispatch(job);
        await this.current;
        this.debug('done');
        this.current = null;
      }
    }
  }

  dispatch(job) {
    const { jobtype, jid } = job;
    const fn = this.registry[jobtype];

    this.debug(`DISPATCH: ${jobtype}`);

    if (!fn) {
      const err = new Error(`No jobtype registered for: ${jobtype}`);
      console.error(err);
      this.debug(`FAIL ${jid} ${err.message}`);
      return this.fail(jid, err);
    }

    // this.log(jobtype);

    return this.execute(fn, job);
  }

  async execute(fn, job) {
    const { jid, args } = job;

    // @TODO invoke middleware stack. koa-compose?
    // @TODO keep in-progress queue to FAIL those jobs during shutdown
    try {
      const thunk = await fn(...args);
      // jobfn returns a function to accept the job payload
      // ex: (...args) => (job) => { ... }
      if (typeof thunk === 'function') {
        await thunk(job);
      }
      this.debug(`ACK ${jid}`);
      await this.ack(jid);
    } catch (e) {
      this.debug(`FAIL ${jid} ${e.message}`);
      await this.fail(jid, e);
      console.error(e);
    }
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
    console.log(this.format(msg));
  }

  debug(msg) {
    debug(this.format(msg));
  }

  format(msg) {
    return [
      new Date().toJSON(),
      `pid=${process.pid}`,
      `wid=${this.wid}`,
      `id=${this.id}`,
      msg
    ].join(' ');
  }
};
