/**
 * StateMachineService — Enforces valid application state transitions.
 * Only Team C changes the authoritative application state.
 */

const { APPLICATION_STATES, VALID_TRANSITIONS } = require('../../../../shared/constants');
const { InvalidTransitionError } = require('../../../../shared/errors');

class StateMachineService {
  /**
   * Check if a transition from `from` to `to` is valid.
   * @param {string} from - Current state
   * @param {string} to   - Target state
   * @returns {boolean}
   */
  isValidTransition(from, to) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  /**
   * Assert a transition is valid; throws InvalidTransitionError if not.
   * @param {string} from
   * @param {string} to
   */
  assertValidTransition(from, to) {
    if (!this.isValidTransition(from, to)) {
      throw new InvalidTransitionError(from, to);
    }
  }

  /**
   * Return all valid next states from a given state.
   * @param {string} state
   * @returns {string[]}
   */
  nextStates(state) {
    return VALID_TRANSITIONS[state] || [];
  }

  /**
   * Check if a state is a terminal state (no further transitions allowed).
   */
  isTerminal(state) {
    return (VALID_TRANSITIONS[state] || []).length === 0;
  }

  /**
   * Check if the state represents a failure/withdrawal.
   */
  isNegativeOutcome(state) {
    return [
      APPLICATION_STATES.NOT_ELIGIBLE,
      APPLICATION_STATES.WITHDRAWN,
      APPLICATION_STATES.EXPIRED,
      APPLICATION_STATES.COMPENSATION_REQUIRED,
    ].includes(state);
  }

  /**
   * All valid states.
   */
  allStates() {
    return Object.values(APPLICATION_STATES);
  }
}

module.exports = new StateMachineService();
