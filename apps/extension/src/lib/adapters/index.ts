import type { SiteAdapter } from "./types";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";

const ADAPTERS: SiteAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter];

export function getAdapter(hostname: string): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.matches(hostname));
}

export type { SiteAdapter };
