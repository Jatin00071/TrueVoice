const shieldService = require('../services/shield.service');

function startShieldCron() {
  cron.schedule('* * * * *', async () => {
    try {
      await shieldService.checkVelocityAllPosts();
    } catch (error) {
      console.error('[Shield Cron] Error:', error.message);
    }
  });

  console.log('[Shield Cron] Started - checking every 60 seconds');
}

module.exports = { startShieldCron };
