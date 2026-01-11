import { useEffect } from 'react';

/**
 * Custom hook to handle Bootstrap modal cleanup
 * Prevents modal backdrop from persisting after modal close
 * 
 * Usage:
 * - Call this hook in any component that uses Bootstrap modals
 * - It will automatically clean up on component unmount
 * - Also provides utility function to manually clean backdrops
 */
export const useModalCleanup = () => {
  useEffect(() => {
    // Cleanup function runs on component unmount
    return () => {
      cleanupModals();
    };
  }, []);

  return { cleanupModals };
};

/**
 * Utility function to clean up all modal-related elements
 * Can be called manually when needed
 */
export const cleanupModals = () => {
  console.log('[Modal Cleanup] Removing all modal artifacts');
  
  // Close all Bootstrap modals
  const modals = document.querySelectorAll('.modal');
  modals.forEach((modalEl) => {
    try {
      const modal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
      if (modal) {
        modal.hide();
      }
    } catch (error) {
      console.error('[Modal Cleanup] Error hiding modal:', error);
    }
  });
  
  // Force remove all backdrops immediately
  // Use setTimeout to catch backdrops created during hide animation
  const removeBackdrops = () => {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    if (backdrops.length > 0) {
      console.log(`[Modal Cleanup] Removing ${backdrops.length} backdrop(s)`);
      backdrops.forEach(backdrop => {
        try {
          backdrop.remove();
        } catch (error) {
          console.error('[Modal Cleanup] Error removing backdrop:', error);
        }
      });
    }
  };
  
  // Remove immediately
  removeBackdrops();
  
  // Also remove after animation delay (300ms is Bootstrap's default)
  setTimeout(removeBackdrops, 350);
  
  // Reset body styles
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
};

/**
 * Close a specific modal programmatically
 * Ensures backdrop cleanup happens after Bootstrap animation completes
 * @param modalId - The ID of the modal element
 * @param forceCleanup - Whether to force immediate cleanup (default: true)
 */
export const closeModal = (modalId: string, forceCleanup: boolean = true) => {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) {
    console.warn(`[Modal Cleanup] Modal with id "${modalId}" not found`);
    return false;
  }

  try {
    const modal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
    if (modal) {
      // Listen for the hidden event to ensure cleanup after animation
      const handleHidden = () => {
        console.log(`[Modal Cleanup] Modal hidden event fired: ${modalId}`);
        
        if (forceCleanup) {
          // Force cleanup backdrops after Bootstrap's hide completes
          setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            if (backdrops.length > 0) {
              console.log(`[Modal Cleanup] Force removing ${backdrops.length} backdrop(s)`);
              backdrops.forEach(backdrop => backdrop.remove());
            }
            
            // Ensure body classes are cleaned
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
          }, 50); // Small delay to let Bootstrap finish
        }
        
        // Remove the event listener
        modalEl.removeEventListener('hidden.bs.modal', handleHidden);
      };
      
      // Add the event listener before hiding
      modalEl.addEventListener('hidden.bs.modal', handleHidden);
      
      // Hide the modal (triggers Bootstrap animation)
      modal.hide();
      console.log(`[Modal Cleanup] Hiding modal: ${modalId}`);
      return true;
    } else {
      console.warn(`[Modal Cleanup] No Bootstrap Modal instance found for: ${modalId}`);
      
      // Fallback: force cleanup even if no instance
      if (forceCleanup) {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        document.body.classList.remove('modal-open');
      }
      
      return false;
    }
  } catch (error) {
    console.error(`[Modal Cleanup] Error closing modal ${modalId}:`, error);
    return false;
  }
};

/**
 * Ensure Bootstrap Modal is initialized for an element
 * @param modalId - The ID of the modal element
 */
export const ensureModalInitialized = (modalId: string) => {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) {
    console.warn(`[Modal Init] Modal with id "${modalId}" not found`);
    return null;
  }

  try {
    let modal = (window as any).bootstrap?.Modal?.getInstance(modalEl);
    
    if (!modal && (window as any).bootstrap?.Modal) {
      // Initialize if not already initialized
      modal = new (window as any).bootstrap.Modal(modalEl);
      console.log(`[Modal Init] Initialized modal: ${modalId}`);
    }
    
    return modal;
  } catch (error) {
    console.error(`[Modal Init] Error initializing modal ${modalId}:`, error);
    return null;
  }
};
