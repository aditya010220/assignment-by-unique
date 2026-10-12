/**
 * In-memory implementation of the LeadStore repository interface.
 * Implements:
 * - exists(id): Promise<boolean>
 * - save(lead): Promise<void>
 * - listSince(timestamp?: string): Promise<Lead[]>
 */
class InMemoryLeadStore {
  constructor() {
    /** @type {Map<string, Object>} */
    this.leads = new Map();
  }

  /**
   * Check if a lead with leadgen_id already exists.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    if (!id) return false;
    return this.leads.has(String(id));
  }

  /**
   * Save a lead. Idempotent: duplicate saves with same id will not overwrite or duplicate.
   * @param {Object} lead
   * @returns {Promise<void>}
   */
  async save(lead) {
    if (!lead || !lead.id) {
      throw new Error('Lead must have an id');
    }
    const id = String(lead.id);
    if (!this.leads.has(id)) {
      this.leads.set(id, {
        ...lead,
        receivedAt: lead.receivedAt || new Date().toISOString(),
      });
    }
  }

  /**
   * List leads, optionally filtered by timestamp, sorted newest first.
   * @param {string} [timestamp] - ISO timestamp string
   * @returns {Promise<Array<Object>>}
   */
  async listSince(timestamp) {
    let allLeads = Array.from(this.leads.values());

    if (timestamp) {
      const sinceDate = new Date(timestamp).getTime();
      if (!isNaN(sinceDate)) {
        allLeads = allLeads.filter(
          (lead) => new Date(lead.receivedAt).getTime() > sinceDate
        );
      }
    }

    // Sort newest first
    return allLeads.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  /**
   * Clears all stored leads (useful for tests).
   */
  async clear() {
    this.leads.clear();
  }

  /**
   * Get count of stored leads.
   */
  async count() {
    return this.leads.size;
  }
}

// Singleton instance for server-wide usage
const leadStore = new InMemoryLeadStore();

module.exports = {
  InMemoryLeadStore,
  leadStore,
};
