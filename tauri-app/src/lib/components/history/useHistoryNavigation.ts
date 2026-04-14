import { get } from 'svelte/store';

export function useHistoryNavigation<T>(
  items: T[],
  options: {
    onSelect?: (item: T, index: number) => void;
    onOpen?: (item: T, index: number) => void;
  } = {}
) {
  let selectedIndex = $state(0);

  function handleKeydown(e: KeyboardEvent) {
    const len = items.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 1);
        if (items[selectedIndex - 1]) {
          options.onSelect?.(items[selectedIndex - 1], selectedIndex - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(len - 1, selectedIndex + 1);
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
        selectedIndex = 0;
        break;
    }
  }

  function selectIndex(index: number) {
    if (index >= 0 && index < items.length) {
      selectedIndex = index;
    }
  }

  return {
    get selectedIndex() { return selectedIndex; },
    handleKeydown,
    selectIndex,
  };
}
