const test = require('ava');
const Client = require('../lib/client');
const {
  createClient: create,
  queueName,
  withConnection: connect,
  mocked
} = require('./_helper');

test.before(async () => {
  await connect(client => client.flush());
});

test.after.always(async () => {
  await connect(client => client.flush());
});

test('job builder sends job specification to server', async (t) => {
  const jobAt = Date.now();
  return mocked((server, port) => {
    server.on('PUSH', ({ data, socket }) => {
      socket.write("+OK\r\n");
      const {
        jobtype,
        args,
        custom,
        priority,
        queue,
        at,
        reserve_for,
        retry
      } = data;
      t.is(jobtype, 'MyJob');
      t.deepEqual(args, [ 1, 2, 3 ]);
      t.deepEqual(custom, { locale: 'en-us' });
      t.is(priority, 10);
      t.is(queue, 'critical');
      t.is(at, jobAt);
      t.is(reserve_for, 300);
      t.is(retry, false);
    });
    return connect({ port }, async (client) => {
      await client.job()
        .type('MyJob')
        .args(1, 2, 3)
        .custom({ locale: 'en-us' })
        .priority(10)
        .queue('critical')
        .at(jobAt)
        .reserveFor(300)
        .retry(false)
        .push();
    });
  });
});

test('job builder sends job specification to server', async (t) => {
  const jobAt = Date.now();
  return mocked((server, port) => {
    server.on('PUSH', ({ data, socket }) => {
      socket.write("+OK\r\n");
      const { retry } = data;
      t.is(retry, true);
    });
    return connect({ port }, async (client) => {
      await client.job()
        .type('MyJob')
        .retry()
        .push();
    });
  });
});

test('.then converts job builder to promise', async (t) => {
  let seq = '';
  t.plan(1);
  return mocked((server, port) => {
    server.on('PUSH', ({ data, socket }) => {
      seq = 'received';
      socket.write("+OK\r\n");
    });
    return connect({ port }, async (client) => {
      await client.job().type('MyJob').args(1, 2, 3);
      t.is(seq, 'received');
    });
  });
});

test('.catch converts job builder to promise', async (t) => {
  let seq = '';
  t.plan(1);
  return mocked((server, port) => {
    server.on('PUSH', ({ data, socket }) => {
      seq = 'received';
      socket.write("+OK\r\n");
    });
    return connect({ port }, async (client) => {
      await client.job()
        .type('MyJob')
        .args(1, 2, 3)
        .catch(() => {
          t.fail();
        });
      t.is(seq, 'received');
    });
  });
});
