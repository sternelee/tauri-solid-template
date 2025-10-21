// ============================================================================
// Raycast usePersistentState Hook Implementation
// ============================================================================
// Based on Raycast API specification for persistent state hooks

import { useState, useEffect, useCallback } from 'react';
import type { PluginStateContext } from '../types';

interface PersistentStateOptions {
  storage?: 'localStorage' | 'sessionStorage';
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

const defaultOptions: PersistentStateOptions = {
  storage: 'localStorage',
  serialize: JSON.stringify,
  deserialize: JSON.parse
};

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options?: PersistentStateOptions,
  stateContext?: PluginStateContext
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const opts = { ...defaultOptions, ...options };
  const [state, setState] = useState<T>(() => {
    // Try to get stored value
    try {
      const storage = opts.storage === 'localStorage' ? localStorage : sessionStorage;
      const storedValue = storage.getItem(key);
      if (storedValue !== null) {
        return opts.deserialize!(storedValue);
      }
    } catch (error) {
      console.error('Error reading from storage:', error);
    }
    return initialValue;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Save to storage when state changes
  useEffect(() => {
    try {
      const storage = opts.storage === 'localStorage' ? localStorage : sessionStorage;
      if (state !== undefined) {
        storage.setItem(key, opts.serialize!(state));
      } else {
        storage.removeItem(key);
      }
    } catch (error) {
      console.error('Error writing to storage:', error);
    }
  }, [key, state, opts]);

  // Set loading to false after initial mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Custom setter that also updates state context if provided
  const setPersistentState = useCallback((newValue: React.SetStateAction<T>) => {
    setState(prevValue => {
      const nextValue = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prevValue)
        : newValue;

      // Update state context if provided
      if (stateContext) {
        stateContext.setPersistentState(key, nextValue);
      }

      return nextValue;
    });
  }, [key, stateContext]);

  return [state, setPersistentState, isLoading];
}

// Legacy compatibility function
export function createPersistentStateHook<T>(pluginId: string) {
  return function usePluginPersistentState(
    key: string,
    initialValue: T,
    options?: PersistentStateOptions
  ): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
    const fullKey = `${pluginId}:${key}`;
    return usePersistentState(fullKey, initialValue, options);
  };
}