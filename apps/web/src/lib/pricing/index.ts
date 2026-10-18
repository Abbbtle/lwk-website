// Prices for memberships and single courses in each price region, and how to show them. Pure
// code, safe in client components. The visitor's region comes from src/server/price-region.ts.

export {
  COURSE_TIERS,
  type CourseTier,
  courseTierName,
  courseTierTitle,
  isCourseTier,
} from './course-tiers';
export { type Currency, formatMoney, type Money, money, toDecimalString } from './money';
export {
  COMMUNITY_MIN_SEATS,
  FAMILY_MAX_PEOPLE,
  FOUNDING_MEMBER_PLACES,
  MEMBERSHIP_TRIAL_DAYS,
  PAID_PLANS_NOTICE_DAYS,
  YEARLY_FULL_REFUND_DAYS,
} from './plan-terms';
export {
  communitySeatPrice,
  coursePrice,
  courseStartingPrice,
  familyPrice,
  foundingMemberPrice,
  freePrice,
  membershipLeadPrice,
  type MembershipPrices,
  membershipPrices,
} from './prices';
export {
  type BillingPeriod,
  billingPeriodPhrase,
  formatRecurring,
  monthlyEquivalent,
  perSeatPhrase,
  type RecurringPrice,
  yearlySavingPercent,
} from './recurring';
export {
  HOME_PRICE_REGION,
  PRICE_REGIONS,
  type PriceRegion,
  regionCurrency,
  regionForCountry,
  regionName,
  regionTaxNote,
  visitorRegionPhrase,
} from './regions';
