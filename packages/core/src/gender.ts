/**
 * Genere grammaticale di una persona, solo per declinare le frasi in italiano
 * («è stata avvisata» / «è stato avvisato»). Non si indovina mai dal nome.
 * 'x' = non specificato: si usano frasi senza desinenze di genere.
 */
export type Gender = 'f' | 'm' | 'x';

export const GENDERS: readonly Gender[] = ['f', 'm', 'x'];

export function isGender(v: unknown): v is Gender {
  return v === 'f' || v === 'm' || v === 'x';
}

/** Sceglie la forma giusta; un valore mancante o strano vale «non specificato». */
export function byGender<T>(gender: Gender | string | null | undefined, forms: { f: T; m: T; x: T }): T {
  return gender === 'f' ? forms.f : gender === 'm' ? forms.m : forms.x;
}

/** Un valore letto dal database o dalla rete diventa sempre un genere valido. */
export function asGender(v: unknown): Gender {
  return isGender(v) ? v : 'x';
}
