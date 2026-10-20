import { describe, expect, it } from 'vitest';
import { validateCompanyInput, validateIndividualInput } from '@/src/lib/customer-validation';

describe('validateIndividualInput', () => {
  it('trims, lowercases email and turns blanks into null', () => {
    expect(
      validateIndividualInput({ first_name: ' Бат ', last_name: '', email: ' Bat@Mail.MN ', phone: '+976 9911-2233', male: 'Эрэгтэй' })
    ).toEqual({
      value: { first_name: 'Бат', last_name: null, email: 'bat@mail.mn', phone: '+976 9911-2233', address: null, male: 'Эрэгтэй', birth_date: null },
    });
  });

  it('rejects missing name, gender, bad email/phone and over-long values', () => {
    expect(validateIndividualInput({ male: 'Эрэгтэй' })).toHaveProperty('error');
    expect(validateIndividualInput({ first_name: 'Бат' })).toHaveProperty('error');
    expect(validateIndividualInput({ first_name: 'Бат', male: 'Эрэгтэй', email: 'bat@' })).toHaveProperty('error');
    expect(validateIndividualInput({ first_name: 'Бат', male: 'Эрэгтэй', phone: 'abc' })).toHaveProperty('error');
    expect(validateIndividualInput({ first_name: 'Бат', male: 'Эрэгтэй', phone: '123' })).toHaveProperty('error');
    expect(validateIndividualInput({ first_name: 'Б'.repeat(101), male: 'Эрэгтэй' })).toHaveProperty('error');
  });
});

describe('validateCompanyInput', () => {
  it('requires name and register number', () => {
    expect(validateCompanyInput({ name: 'ХХК' })).toHaveProperty('error');
    expect(validateCompanyInput({ name: 'ХХК', tax_number: ' 1234567 ' })).toEqual({
      value: { name: 'ХХК', tax_number: '1234567', email: null, phone: null, address: null },
    });
  });
});
