/**
 * A field people never see or reach with the keyboard; spam bots fill in every field, so a
 * value here marks the submission as automated (see `isBot`).
 */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="fax">Leave this empty</label>
      <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export const isBot = (formData: FormData) => Boolean(formData.get('fax'));
