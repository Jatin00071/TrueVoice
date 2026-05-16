const cron = require('node-cron');
const messageService = require('../services/message.service');

let task = null;

function start() {
  if (task) return;
  task = cron.schedule('*/2 * * * * *', async () => {
    try {
      await messageService.processQueue();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[MessageQueue] Queue processing failed:', error);
    }
  });
  task.start();
}

function stop() {
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = { start, stop };
