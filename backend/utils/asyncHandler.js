/**
 * Async Handler Utility
 * Wraps async route handlers to catch errors and pass them to Express error middleware
 * Replacement for express-async-handler package
 */

/**
 * Wraps an async function to catch any errors and pass to next()
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
