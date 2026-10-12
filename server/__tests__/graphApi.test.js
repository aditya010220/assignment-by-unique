const axios = require('axios');
const { fetchLead, normalizeFieldData } = require('../services/graphApi');

jest.mock('axios');

describe('Graph API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lead details and normalizes data successfully', async () => {
    const mockApiResponse = {
      data: {
        id: 'lead_12345',
        form_id: 'form_888',
        page_id: 'page_999',
        field_data: [
          { name: 'full_name', values: ['Jane Doe'] },
          { name: 'email', values: ['jane@example.com'] },
          { name: 'phone_number', values: ['+19876543210'] },
          { name: 'custom_question', values: ['Interested in demo'] },
        ],
      },
    };

    axios.get.mockResolvedValueOnce(mockApiResponse);

    const result = await fetchLead('lead_12345');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/lead_12345',
      expect.objectContaining({
        params: expect.objectContaining({
          fields: 'id,created_time,ad_id,form_id,page_id,field_data',
        }),
      })
    );

    expect(result.id).toBe('lead_12345');
    expect(result.formId).toBe('form_888');
    expect(result.pageId).toBe('page_999');
    expect(result.name).toBe('Jane Doe');
    expect(result.email).toBe('jane@example.com');
    expect(result.phone).toBe('+19876543210');
    expect(result.rawFieldData).toEqual({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      phone_number: '+19876543210',
      custom_question: 'Interested in demo',
    });
    expect(result.receivedAt).toBeDefined();
  });

  it('retries up to 2 times on transient failures before succeeding', async () => {
    axios.get
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'))
      .mockResolvedValueOnce({
        data: {
          id: 'lead_retry_success',
          form_id: 'form_1',
          page_id: 'page_1',
          field_data: [{ name: 'email', values: ['retry@example.com'] }],
        },
      });

    const result = await fetchLead('lead_retry_success', {
      maxRetries: 2,
      initialDelayMs: 5,
    });

    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(result.id).toBe('lead_retry_success');
    expect(result.email).toBe('retry@example.com');
  });

  it('throws after exhausting all retries on persistent failure', async () => {
    axios.get.mockRejectedValue(new Error('Meta Graph API 500 error'));

    await expect(
      fetchLead('lead_fail', { maxRetries: 2, initialDelayMs: 5 })
    ).rejects.toThrow('Meta Graph API 500 error');

    // 1 initial attempt + 2 retries = 3 calls
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('normalizes first_name and last_name when full_name is absent', () => {
    const fields = [
      { name: 'first_name', values: ['Alice'] },
      { name: 'last_name', values: ['Smith'] },
      { name: 'email', values: ['alice@smith.org'] },
    ];
    const normalized = normalizeFieldData(fields);
    expect(normalized.name).toBe('Alice Smith');
    expect(normalized.email).toBe('alice@smith.org');
  });
});
