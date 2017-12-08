const Client = require('faktory-client');
const Manager = require('./manager');

const registry = {};
const middleware = [];

module.exports = {
  get registry() {
    return registry;
  },
  use(fn) {
    middleware.push(fn);
    return this;
  },
  register(name, fn) {
    registry[name] = fn;
    return this;
  },
  connect(...args) {
    return new Client(...args).connect();
  },
  async work(options = {}) {
    const manager = new Manager(
      Object.assign({}, options, { registry, middleware })
    );
    return manager.run();
  }
};
