/**
 * @fileoverview Every path in the app, in one place, so no component builds a
 * URL out of string pieces.
 */

export const routes = {
  boothDetail: (boothId: string): string => `/temple/${boothId}`,
  boothSimulator: '/booth-simulator',
  consultationHistory: '/me/consultation-history',
  farm: '/farm',
  jano: '/jano',
  pass: '/pass',
  temple: '/temple',
} as const;
