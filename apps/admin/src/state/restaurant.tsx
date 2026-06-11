import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Restaurant } from '../api/types';

interface RestaurantContextValue {
  restaurants: Restaurant[];
  selected: Restaurant | null;
  setSelectedId: (id: string) => void;
  isLoading: boolean;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurants: [],
  selected: null,
  setSelectedId: () => {},
  isLoading: true,
});

const STORAGE_KEY = 'mesaparatres_restaurant';

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => api<Restaurant[]>('/restaurants'),
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY),
  );

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const selected = useMemo(() => {
    if (!restaurants.length) return null;
    return restaurants.find((r) => r.id === selectedId) ?? restaurants[0];
  }, [restaurants, selectedId]);

  return (
    <RestaurantContext.Provider
      value={{ restaurants, selected, setSelectedId, isLoading }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  return useContext(RestaurantContext);
}
