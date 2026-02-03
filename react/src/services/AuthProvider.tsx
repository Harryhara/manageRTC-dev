/**
 * Authentication Provider
 * Manages Clerk authentication token for API requests
 *
 * NOTE: Company ID is extracted server-side from the JWT token's public metadata
 * by the backend authentication middleware (same pattern as Socket.IO).
 * The frontend only needs to send the Authorization Bearer token.
 *
 * This provider must wrap the entire application
 */

import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { setAuthToken } from './api';

/**
 * AuthProvider Component
 * Wraps the app to provide authentication token to API service
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    // Don't proceed if auth is not loaded or user is not signed in
    if (!isLoaded || !isSignedIn) {
      console.log('[AuthProvider] User not signed in or auth not loaded');
      setAuthToken(null);
      return;
    }

    // Function to update token
    const updateToken = async () => {
      try {
        console.log('[AuthProvider] Requesting fresh token...');
        const token = await getToken({ skipCache: true }); // Force fresh token
        setAuthToken(token);
        console.log('[AuthProvider] Token updated successfully');
      } catch (error) {
        console.error('[AuthProvider] Failed to get token:', error);
        setAuthToken(null);
      }
    };

    // Get initial token
    updateToken();

    // Update token more frequently (every 2 minutes) to avoid expiration
    const interval = setInterval(updateToken, 2 * 60 * 1000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [getToken, isSignedIn, isLoaded]);

  return <>{children}</>;
};

export default AuthProvider;
