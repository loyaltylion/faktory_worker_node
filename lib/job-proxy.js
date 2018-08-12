class JobProxy {
  constructor(client) {
    this.client = client;
    this.payload = {
      args: [],
    };
  }
  type(jobtype) {
    this.payload.jobtype = jobtype;
    return this;
  }
  // with?
  args(...args) {
    this.payload.args = args;
    return this;
  }
  at(time) {
    this.payload.at = time;
    return this;
  }
  retry(enable = true) {
    this.payload.retry = enable;
    return this;
  }
  custom(data) {
    this.payload.custom = data;
    return this;
  }
  reserveFor(seconds) {
    this.payload.reserve_for = seconds;
    return this;
  }
  queue(name) {
    this.payload.queue = name;
    return this;
  }
  priority(num) {
    this.payload.priority = parseInt(num, 10);
    return this;
  }
  toJSON() {
    return Object.assign({}, this.payload);
  }
  push() {
    return this.client.push(this.toJSON());
  }
  then(...args) {
    return this.push().then(...args);
  }
  catch(...args) {
    return this.push().catch(...args);
  }
}

module.exports = JobProxy;
