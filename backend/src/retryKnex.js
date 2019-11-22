const { retry } = require('./retry.js');
const retryOpts = {
  factor: 1.5,
  minTimeout: 2000,
  retries: 20
};
const dbStartupErrorCodes = ['ENOTFOUND', 'ECONNREFUSED', '57P03', '57P03'];

const retryKnex = async (thunk) => {
  let attempts = 0;
  await retry(async (throwFatal) => {
    try {
      attempts++;
      await thunk();
      if (attempts > 1) {
        console.log(`Knex operation succeeded after ${attempts} attempts.`);
      }
    } catch (error) {
      if (dbStartupErrorCodes.includes(error.code)) {
        console.log(`Ignoring Knex error '${stringify(error.code)}'.`);
        // Error: the database system is starting up
        // Solution: try again later
        throw error;
      } else {
        console.error('! Fatal Knex error:', stringify(error));
        throwFatal(error);
      }
    }
  }, retryOpts);
};

module.exports = retryKnex;
