import cron from 'node-cron';
import { getTenantCollections } from '../config/db.js';
import { processPendingPromotions } from '../services/performance/promotion.services.js';

/**
 * Scheduled job to automatically apply promotions when their effective date is reached
 * Runs daily at 12:00 AM (midnight)
 */

let schedulerRunning = false;

/**
 * Start the promotion scheduler
 */
export async function startPromotionScheduler() {
  if (schedulerRunning) {
    console.log('[PromotionScheduler] Scheduler already running');
    return;
  }

  // Schedule task to run every day at midnight (00:00)
  // Format: second minute hour day month day-of-week
  // '0 0 * * *' = At 00:00 every day
  const schedule = cron.schedule('0 0 * * *', async () => {
    console.log('[PromotionScheduler] Running daily promotion check at', new Date().toISOString());
    await processAllCompanyPromotions();
  });

  schedulerRunning = true;
  console.log('[PromotionScheduler] Started successfully. Will run daily at midnight.');

  // Also run immediately on startup to catch any missed promotions
  console.log('[PromotionScheduler] Running initial check on startup...');
  await processAllCompanyPromotions();

  return schedule;
}

/**
 * Stop the promotion scheduler
 */
export function stopPromotionScheduler(schedule) {
  if (schedule) {
    schedule.stop();
    schedulerRunning = false;
    console.log('[PromotionScheduler] Stopped');
  }
}

/**
 * Process pending promotions for all companies/tenants
 */
async function processAllCompanyPromotions() {
  try {
    // Get list of all company IDs from the system
    // Note: You'll need to adjust this based on how you track companies
    const collections = await getTenantCollections('system'); // or your admin db
    
    // Get all unique company IDs from a companies collection or similar
    // For now, we'll need to get this from your existing company tracking mechanism
    const companies = await collections.companies.find({ isActive: true }).toArray();
    
    console.log(`[PromotionScheduler] Found ${companies.length} active companies`);
    
    let totalApplied = 0;
    let totalFailed = 0;

    for (const company of companies) {
      try {
        const result = await processPendingPromotions(company._id.toString());
        totalApplied += result.applied;
        totalFailed += result.failed;
      } catch (error) {
        console.error(`[PromotionScheduler] Error processing promotions for company ${company._id}:`, error);
      }
    }

    console.log(`[PromotionScheduler] Completed: ${totalApplied} promotions applied, ${totalFailed} failed`);
  } catch (error) {
    console.error('[PromotionScheduler] Error in processAllCompanyPromotions:', error);
  }
}

/**
 * Manual trigger for testing - process promotions for a specific company
 */
export async function manualTriggerPromotion(companyId) {
  console.log(`[PromotionScheduler] Manual trigger for company ${companyId}`);
  return await processPendingPromotions(companyId);
}
