import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { metroNetworkRepository } from '../storage/metroNetworkRepository';
import type { MetroNetwork } from '../types';

export type { MetroNetwork };

export const NETWORK_NAMES: Record<MetroNetwork, string> = {
  dmrc: 'Namma Metro',
  nmrc: 'Namma Metro',
};

interface MetroNetworkContextValue {
  network: MetroNetwork;
  networkName: string;
  isLoaded: boolean;
  setNetwork: (network: MetroNetwork) => void;
  toggleNetwork: () => void;
}

const MetroNetworkContext = createContext<MetroNetworkContextValue | null>(null);

export function MetroNetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<MetroNetwork>('dmrc');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // One operator runs this network, so a stored Noida selection from an
    // older install must not survive as a second scope.
    let active = true;
    void metroNetworkRepository.load().then(() => {
      if (!active) return;
      setNetworkState('dmrc');
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setNetwork = useCallback((_nextNetwork: MetroNetwork) => {
    setNetworkState('dmrc');
    void metroNetworkRepository.save('dmrc');
  }, []);

  const toggleNetwork = useCallback(() => {}, []);

  const value = useMemo<MetroNetworkContextValue>(
    () => ({
      network,
      networkName: NETWORK_NAMES[network],
      isLoaded,
      setNetwork,
      toggleNetwork,
    }),
    [isLoaded, network, setNetwork, toggleNetwork],
  );

  return (
    <MetroNetworkContext.Provider value={value}>
      {children}
    </MetroNetworkContext.Provider>
  );
}

export function useMetroNetwork(): MetroNetworkContextValue {
  const context = useContext(MetroNetworkContext);
  if (!context) {
    throw new Error('useMetroNetwork must be used within MetroNetworkProvider');
  }
  return context;
}

