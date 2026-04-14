import { useCallback, useEffect, useState } from 'svelte';

export function useHistoryNavigation<T>(
  items: T[],
  options: {
    onSelect?: (item: T, index: number) => void;
    onOpen?: (item: T, index: number) => void;
  } = {}
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (selectedIndex >= items.length && items.length > 0) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length, selectedIndex]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        if (items[selectedIndex - 1]) {
          options.onSelect?.(items[selectedIndex - 1], selectedIndex - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
        if (items[selectedIndex + 1]) {
          options.onSelect?.(items[selectedIndex + 1], selectedIndex + 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIndex]) {
          options.onOpen?.(items[selectedIndex], selectedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedIndex(0);
        break;
    }
  }, [items, selectedIndex, options]);

  const selectIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setSelectedIndex(index);
    }
  }, [items.length]);

  return {
    selectedIndex,
    handleKeydown,
    selectIndex,
  };
}
