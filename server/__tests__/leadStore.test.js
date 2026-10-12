const { InMemoryLeadStore } = require('../services/leadStore');

describe('InMemoryLeadStore', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryLeadStore();
  });

  it('correctly saves and checks existence of a lead', async () => {
    expect(await store.exists('lead_001')).toBe(false);

    const lead = {
      id: 'lead_001',
      formId: 'form_1',
      pageId: 'page_1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      rawFieldData: { full_name: 'John Doe', email: 'john@example.com' },
      receivedAt: '2026-10-12T10:00:00.000Z',
    };

    await store.save(lead);
    expect(await store.exists('lead_001')).toBe(true);
    expect(await store.count()).toBe(1);
  });

  it('guarantees idempotency: duplicate save() does not create a second entry', async () => {
    const lead = {
      id: 'lead_002',
      formId: 'form_2',
      pageId: 'page_2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      receivedAt: '2026-10-12T10:05:00.000Z',
      rawFieldData: {},
    };

    await store.save(lead);
    await store.save(lead);
    await store.save({ ...lead, name: 'Attempted Overwrite' });

    expect(await store.count()).toBe(1);
    const leads = await store.listSince();
    expect(leads).toHaveLength(1);
    expect(leads[0].name).toBe('Jane Smith'); // Original record preserved
  });

  it('lists leads ordered newest first', async () => {
    await store.save({
      id: 'lead_1',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: '2026-10-12T10:00:00.000Z',
      rawFieldData: {},
    });
    await store.save({
      id: 'lead_2',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: '2026-10-12T10:30:00.000Z',
      rawFieldData: {},
    });
    await store.save({
      id: 'lead_3',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: '2026-10-12T10:15:00.000Z',
      rawFieldData: {},
    });

    const leads = await store.listSince();
    expect(leads.map((l) => l.id)).toEqual(['lead_2', 'lead_3', 'lead_1']);
  });

  it('filters leads with listSince(timestamp)', async () => {
    await store.save({
      id: 'lead_1',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: '2026-10-12T10:00:00.000Z',
      rawFieldData: {},
    });
    await store.save({
      id: 'lead_2',
      formId: 'form_1',
      pageId: 'page_1',
      receivedAt: '2026-10-12T10:30:00.000Z',
      rawFieldData: {},
    });

    const filtered = await store.listSince('2026-10-12T10:15:00.000Z');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('lead_2');
  });
});
