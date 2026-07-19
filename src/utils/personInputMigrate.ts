import type { PersonInput } from '../types/calculator';

/**
 * Ensure `cppStartYear` is set (legacy saves only had arrival year).
 * OAS still uses `startYearInCanada`; CPP uses work start.
 */
export function withCppStartYear(person: PersonInput): PersonInput {
  if (person.cppStartYear != null && Number.isFinite(person.cppStartYear)) {
    return person;
  }
  return { ...person, cppStartYear: person.startYearInCanada };
}
