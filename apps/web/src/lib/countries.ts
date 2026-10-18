import { COUNTRY_CODES } from './country-code';

// Countries offered as a nationality: every country code except dependent territories and
// uninhabited areas. Names come from Intl so no country list needs maintaining.
const notNationalities = new Set(
  'AI AQ AS AW AX BL BM BQ BV CC CK CW CX EH FK FO GF GG GI GL GP GS GU HM IM IO JE KY MF MP MQ MS NC NF NU PF PM PN RE SH SJ SX TC TF TK UM VG VI WF YT'.split(
    ' ',
  ),
);

const names = new Intl.DisplayNames(['en'], { type: 'region' });

export const countries = COUNTRY_CODES.filter((code) => !notNationalities.has(code))
  .map((code) => names.of(code) ?? code)
  .sort((a, b) => a.localeCompare(b));
