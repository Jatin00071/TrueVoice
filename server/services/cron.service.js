const cron = require('node-cron');
const shieldService = require('./shield.service');
const { sweep } = require('../config/blocklist');
const messageQueueCron = require('../jobs/messageQueue.cron');

let task = null;

function start() {
  if (task) return;
  messageQueueCron.start();
  task = cron.schedule('* * * * *', async () => {
    try {
      await shieldService.runAutoCycle();
      sweep();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('cron error', e);
    }
  });
  task.start();
}

function stop() {
  messageQueueCron.stop();
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = { start, stop };
