import cron from 'node-cron';

// fri,sat,..,wednesday night
// show brief forecast for tomorrow
cron.schedule("0 20 * * 0-3,5-6",()=>{
  
});
