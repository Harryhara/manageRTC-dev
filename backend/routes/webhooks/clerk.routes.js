/**
 * Clerk Webhook Routes
 * Handles incoming webhook events from Clerk
 */

import express from 'express';
import { handleClerkWebhook } from '../../controllers/webhooks/clerk.webhook.js';

const router = express.Router();

/**
 * @route   POST /api/webhooks/clerk
 * @desc    Handle Clerk webhook events (user.created, user.updated, user.deleted)
 * @access  Public (webhook signature verification)
 */
router.post('/clerk', handleClerkWebhook);

export default router;
