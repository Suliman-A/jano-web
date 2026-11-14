/**
 * @fileoverview Icons keyed by what they mean, not by what they are called in
 * the icon library. Nothing outside this file imports from lucide, so the
 * library can be swapped without touching a screen.
 */

import {
  ChevronRight,
  ClipboardPlus,
  Clock,
  Landmark,
  List,
  Map,
  MapPin,
  MessageSquarePlus,
  Pill,
  ScanLine,
  Search,
  SlidersHorizontal,
  Sprout,
  User,
} from 'lucide-react';

export const iconRegistry = {
  chevron: ChevronRight,
  history: Clock,
  list: List,
  map: Map,
  pin: MapPin,
  prescriptions: Pill,
  profile: ClipboardPlus,
  scan: ScanLine,
  search: Search,
  settings: SlidersHorizontal,
  tabFarm: Sprout,
  tabJano: MessageSquarePlus,
  tabMe: User,
  tabTemple: Landmark,
  temple: Landmark,
} as const;

export type IconName = keyof typeof iconRegistry;
