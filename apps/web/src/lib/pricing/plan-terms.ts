// The terms that go with the prices, as Plans & Pricing and the help centre state them (and as
// checkout will apply them when paid plans open).

/** Family covers up to this many people in one household. */
export const FAMILY_MAX_PEOPLE = 5;
/** Community plans, for temples, schools and study groups, start at this many seats. */
export const COMMUNITY_MIN_SEATS = 5;
/** How many first members get the founding price, besides everyone joining in early access. */
export const FOUNDING_MEMBER_PLACES = 1000;
/** Days of Membership free before the first payment. */
export const MEMBERSHIP_TRIAL_DAYS = 7;
/** Days after any payment (a single course, or a monthly or yearly membership) in which it is refunded in full. */
export const REFUND_WINDOW_DAYS = 30;
/** Days of notice given before paid plans open. */
export const PAID_PLANS_NOTICE_DAYS = 30;
/** Days a membership whose renewal failed still opens courses, while the payment is tried again. */
export const PAST_DUE_GRACE_DAYS = 3;
