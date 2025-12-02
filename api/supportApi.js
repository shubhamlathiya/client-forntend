import apiClient from "../utils/apiClient";

export const createEnquiry = async ({ name, email, subject, message }) => {
  const res = await apiClient.post('/api/support/enquiries', { name, email, subject, message });
  return res.data;
};

export const getMyTickets = async ({ page = 1, limit = 20 } = {}) => {
  const res = await apiClient.get('/api/support/tickets/my', { params: { page, limit } });
  console.log(res.data)
  return res.data;
};

export const createTicket = async ({ subject, description, priority = 'low', attachments = [] } = {}) => {
  const body = { subject, description, priority, ...(attachments.length ? { attachments } : {}) };
  const res = await apiClient.post('/api/support/tickets', body);
  return res.data;
};

export const getTicketById = async (id) => {
  const res = await apiClient.get(`/api/support/tickets/${id}`);
  return res.data;
};

export const updateTicket = async (id, updates = {}) => {
  const res = await apiClient.patch(`/api/support/tickets/${id}`, updates);
  return res.data;
};

