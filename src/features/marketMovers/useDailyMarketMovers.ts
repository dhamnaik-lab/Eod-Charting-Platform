import { useEffect } from 'react';
import { useMarketMoversStore } from './marketMoversStore';

export function useDailyMarketMovers() {
  const state = useMarketMoversStore();
  useEffect(() => {
    state.activateConsumer();
    return () => state.deactivateConsumer();
  }, [state.activateConsumer, state.deactivateConsumer]);
  return state;
}
