import { createContext, useContext, useSyncExternalStore } from "react";

export const MotionPreference = createContext(false);
export const useMotionPaused = () => useContext(MotionPreference);

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (callback: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
export const useDeviceReducedMotion = () => useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);

// Touch layouts keep decorative motion inside each section instead of moving a
// fixed WebGL canvas across a native scrolling page. Subscribe for rotation.
const compactQuery = "(max-width: 768px), (max-height: 750px), (pointer: coarse)";
const subscribeCompact = (callback: () => void) => {
  const media = matchMedia(compactQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
export const useCompactMotion = () => useSyncExternalStore(subscribeCompact, () => matchMedia(compactQuery).matches, () => false);
