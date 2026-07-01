import axios from 'axios';

const BREVO_API_URL = 'https://api.brevo.com/v3';
const API_KEY = process.env.BREVO_API_KEY;

const headers = {
  'api-key': API_KEY,
  'Content-Type': 'application/json',
};

export const brevoApi = {
  sendEmail: async ({ to, subject, htmlContent, templateId, params }) => {
    const payload = {
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME
      },
      to: [{ email: to }],
      subject,
      htmlContent
    };

    if (templateId) {
      payload.templateId = templateId;
      payload.params = params;
    }

    const response = await axios.post(`${BREVO_API_URL}/smtp/email`, payload, { headers });
    return response.data;
  },

  createContact: async ({ email, attributes, listIds }) => {
    const response = await axios.post(
      `${BREVO_API_URL}/contacts`,
      { email, attributes, listIds },
      { headers }
    );
    return response.data;
  },

  addToList: async (listId, email) => {
    await axios.post(
      `${BREVO_API_URL}/contacts/lists/add`,
      { emails: [email], listId },
      { headers }
    );
  },

  getAccount: async () => {
    const response = await axios.get(`${BREVO_API_URL}/account`, { headers });
    return response.data;
  }
};