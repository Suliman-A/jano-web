/**
 * @fileoverview Every path the app can ask for. A real backend would map these
 * onto URLs; today they select a handler in the mock backend.
 */

export enum Endpoint {
  Book = 'bookings/create',
  Booths = 'booths/list',
  CheckIn = 'visits/check-in',
  CheckOut = 'visits/check-out',
  Farm = 'metrics/farm',
  Pass = 'passes/for-visit',
  RecordReading = 'visits/record-reading',
  Slots = 'slots/list',
  Visits = 'visits/list',
}
