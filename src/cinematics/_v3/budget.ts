// v3 time budget constants shared by the kits (docs/ANIMASYON_PLANI.md §5, A0 §6.2 items 3–4).
// Only read under ?look=v3.

/** The LP counter roll (and the bar's ghost drain) of a damage / heal: ≤ 400 ms (plan §5 "~0,4 sn"). */
export const LP_ROLL_MAX_MS = 400;

/** The attack declaration, handler start → end: ≤ 0.3 s (A0 §6.2 item 4). */
export const DECLARE_MAX_MS = 300;

/**
 * Scene-time beat after a contact hit-stop before a death starts from the reaction pose. 150 (was
 * 110): the struck pose reads before the body breaks (docs/v3/TEMPO.md, owner: "too fast").
 */
export const DEATH_AFTER_CONTACT_MS = 150;
