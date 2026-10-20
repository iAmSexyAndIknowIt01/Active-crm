import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// Клиент дээр hydrate хийгдсэний дараа true. Server болон hydration-ий үед false тул
// зөвхөн клиентэд мэдэгдэх утга (theme, portal)-аас үүсэх зөрүүнээс сэргийлнэ.
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
