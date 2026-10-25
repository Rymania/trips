import { describe, expect, it } from 'vitest';
import { ageInYears, familyDefaults, type FamilyMemberLike } from './family';

// 25 October 2026 (months are 0-based in the Date constructor).
const TODAY = new Date(2026, 9, 25);

const adult: FamilyMemberLike = { kind: 'adult', birth: null };
const dog: FamilyMemberLike = { kind: 'dog', birth: null };
const child = (year: number, month: number): FamilyMemberLike => ({
  kind: 'child',
  birth: { year, month },
});

describe('ageInYears', () => {
  it('counts the birthday from the first day of the birth month', () => {
    expect(ageInYears({ year: 2022, month: 10 }, TODAY)).toBe(4);
    expect(ageInYears({ year: 2022, month: 11 }, TODAY)).toBe(3);
    expect(ageInYears({ year: 2022, month: 10 }, new Date(2026, 9, 1))).toBe(4);
    expect(ageInYears({ year: 2022, month: 10 }, new Date(2026, 8, 30))).toBe(3);
  });

  it('never goes below zero', () => {
    expect(ageInYears({ year: 2026, month: 12 }, TODAY)).toBe(0);
  });
});

describe('familyDefaults', () => {
  it('derives age groups, family size and dog-friendly', () => {
    expect(familyDefaults([adult, adult, child(2019, 3), child(2024, 1), dog], TODAY)).toEqual({
      ageGroups: ['0-3', '4-7'],
      familySize: 4,
      dogFriendly: true,
    });
  });

  it('moves a child into the next group in their birth month', () => {
    expect(familyDefaults([child(2022, 10)], TODAY).ageGroups).toEqual(['4-7']);
    expect(familyDefaults([child(2022, 11)], TODAY).ageGroups).toEqual(['0-3']);
  });

  it('counts children of 18 or over in the family but adds no age group', () => {
    expect(familyDefaults([adult, child(2008, 1)], TODAY)).toEqual({ familySize: 2 });
  });

  it('lists each group once, in age order', () => {
    expect(
      familyDefaults([child(2016, 1), child(2020, 5), child(2021, 6)], TODAY).ageGroups,
    ).toEqual(['4-7', '8-12']);
  });

  it('sets only dog-friendly for a dog on its own', () => {
    expect(familyDefaults([dog], TODAY)).toEqual({ dogFriendly: true });
  });

  it('sets nothing for an empty family', () => {
    expect(familyDefaults([], TODAY)).toEqual({});
  });

  it('caps the family size at 20', () => {
    expect(
      familyDefaults(
        Array.from({ length: 25 }, () => adult),
        TODAY,
      ).familySize,
    ).toBe(20);
  });
});
