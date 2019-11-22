const defaultRetryPolicy = {
  retries: 7,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: Infinity,
  randomize: false
};

const retry = async (delegate, options) => {
  // Merge options with defaults:
  const { factor, maxTimeout, minTimeout, randomize, retries } = Object.assign(
    {},
    defaultRetryPolicy,
    options
  );
  if (minTimeout > maxTimeout) {
    throw new Error('minTimeout is greater than maxTimeout');
  }

  let attempts = 1;
  let complete = false;
  let result = undefined;
  let fatalError = undefined;

  const tryOnce = async () => {
    try {
      result = await delegate((error) => {
        fatalError = error;
      });
      complete = true;
    } catch (error) {
      if (attempts < retries) {
        const random = randomize ? Math.random() + 1 : 1;
        const ms = Math.round(
          random * minTimeout * Math.pow(factor, attempts++)
        );
        await delay(Math.min(ms, maxTimeout));
      } else {
        throw error;
      }
    }
  };

  while (!complete) {
    await tryOnce();
  }
  if (fatalError) {
    throw fatalError;
  }
  return result;
};

exports.retry = retry;

const delay = async (ms, result) => {
  return new Promise((resolve) => setTimeout(() => resolve(result), ms));
};
exports.delay = delay;
