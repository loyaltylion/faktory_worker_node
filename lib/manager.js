const debug = require('debug')('faktory-worker:manager');
const Client = require('faktory-client');
const uuid = require('uuid');
const pool = require('generic-pool');
const Processor = require('./processor');

module.exports = class Manager {
  constructor(options = {}) {
    const opts = Object.assign({
      wid: uuid().slice(0, 8),
      concurrency: 20,
      timeout: 8000
    }, options);

    this.concurrency = opts.concurrency;
    this.timeout = opts.timeout;
    this.wid = opts.wid;

    this.pool = this.constructor.createPool(opts, this.concurrency + 2);
    opts.withConnection = this.withConnection.bind(this);

    this.processors = [];
    for (let i = 0; i < this.concurrency; i += 1) {
      this.processors.push(new Processor(Object.assign({ id: i }, opts)));
    }
  }

  static createPool(options, size) {
    return pool.createPool({
      create() {
        debug('Connection created');
        return new Client(options).connect();
      },
      destroy(client) {
        return client.close();
      }
    }, {
      min: 1,
      max: size
    });
  }

  async withConnection(fn, priority) {
    const client = await this.pool.acquire(priority);
    try {
      return fn(client);
    } finally {
      await this.pool.release(client);
    }
  }

  trapSignals() {
    process
      .on('SIGTERM', () => this.stop())
      .on('SIGTSTP', () => this.quiet())
      .on('SIGINT', () => this.stop());
  }

  /**
   * stop accepting new jobs and continue working on what's currently in progress
   * @return {void}
   */
  quiet() {
    this.log('Quieting');
    this.processors.map(p => p.quiet());
  }

  /**
   * stop accepting new jobs, fail those that are in progress and shutdown
   * @return {[type]} [description]
   */
  async stop() {
    this.quiet();

    if (this._stopping) {
      return Promise.resolve();
    }

    this.log('Stopping');
    this._stopping = true;
    const start = Date.now();

    // set timeout: shutdown
    const timeoutId = setTimeout(() => {
      this.shutdown();
    }, this.timeout);

    await Promise.all(this.processors.map(p => p.stop()));
    clearTimeout(timeoutId);
    return this.shutdown();
  }

  async shutdown() {
    this.log(`Shutting down. In progress: ${this.busy.length}`);
    clearInterval(this.heartbeat);
    await this.pool.drain();
    this.pool.clear();
    this.exit();
  }

  exit(code = 0) {
    process.exit(code);
  }

  get busy() {
    return this.processors.filter(p => p.working);
  }

  run() {
    this.trapSignals();
    this.startHeartbeat();
    this.processors.map(p => p.start());
    return this;
  }

  async beat() {
    debug('BEAT');
    const resp = await this.withConnection(c => c.beat());
    switch(resp) {
      case 'quiet':
        this.log('Got "quiet" signal from server');
        this.quiet();
      break;
      case 'terminate':
        this.log('Got "terminate" signal from server');
        this.stop();
      break;
      default:
        // ok
      break;
    }
  }

  startHeartbeat() {
    this.heartbeat = setInterval(this.beat.bind(this), 15000);
    return this;
  }

  log(msg) {
    console.log(`${new Date().toJSON()} faktory-manager wid=${this.wid} ${msg}`);
  }
};
