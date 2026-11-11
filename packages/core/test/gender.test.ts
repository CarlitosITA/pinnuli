import { describe, expect, it } from 'vitest';
import { asGender, byGender } from '../src/gender';

describe('genere nelle frasi', () => {
  const forms = { f: 'avvisata', m: 'avvisato', x: 'ha ricevuto un avviso' };
  it('sceglie la forma giusta', () => {
    expect(byGender('f', forms)).toBe('avvisata');
    expect(byGender('m', forms)).toBe('avvisato');
    expect(byGender('x', forms)).toBe('ha ricevuto un avviso');
  });
  it('un valore mancante o strano vale «non specificato»', () => {
    expect(byGender(undefined, forms)).toBe(forms.x);
    expect(byGender(null, forms)).toBe(forms.x);
    expect(byGender('boh', forms)).toBe(forms.x);
    expect(asGender('boh')).toBe('x');
    expect(asGender('f')).toBe('f');
  });
});
