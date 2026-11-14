"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerSnapshot = () => undefined;

/** Render a stable server placeholder before reading the browser's timezone. */
export function useLocalTimezone() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
