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

// Touch and short layouts use a native sticky art shelf with flowing copy.
// Subscribe for rotation so desktop pinning never traps enlarged phone text.
const compactQuery = "(max-width: 768px), (max-height: 750px), (pointer: coarse)";
const subscribeCompact = (callback: () => void) => {
  const media = matchMedia(compactQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
export const useCompactMotion = () => useSyncExternalStore(subscribeCompact, () => matchMedia(compactQuery).matches, () => false);
