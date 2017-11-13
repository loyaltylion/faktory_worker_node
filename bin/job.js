const faktory = require('../');

faktory.register('MyJob', async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      setTimeout(() => {
        setTimeout(resolve, Math.random() * 100);
      }, Math.random() * 30);
    }, Math.random() * 50);
  })
});
