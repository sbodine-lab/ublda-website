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
