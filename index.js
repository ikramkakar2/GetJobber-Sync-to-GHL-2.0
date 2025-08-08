import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const GHL_BASE = 'https://rest.gohighlevel.com/v1';

// Headers for GHL
const headers = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type': 'application/json',
};

// Parse JSON bodies
app.use(express.json());

// Utility: Map Jobber status to GHL tag
function mapJobberStatusToTag(jobStatus, visitStatus, invoiceStatus) {
  if (jobStatus === 'requires_action') return 'New Request / Lead In';
  if (jobStatus === 'quote_sent') return 'Quote Sent';
  if (visitStatus === 'scheduled') return 'Job Scheduled';
  if (jobStatus === 'assigned') return 'Technician Assigned';
  if (visitStatus === 'in_progress') return 'Job In Progress';
  if (visitStatus === 'completed') return 'Job Completed';
  if (invoiceStatus === 'paid') return 'Payment Collected';
  if (jobStatus === 'closed') return 'Job Closed';
  return null;
}

// Lookup contact by email
async function findContactByEmail(email) {
  const res = await axios.get(`${GHL_BASE}/contacts/lookup?email=${email}`, { headers });
  return res.data.contact || null;
}

// Create a contact
async function createContact({ name, email }) {
  const res = await axios.post(`${GHL_BASE}/contacts/`, {
    firstName: name,
    email,
    locationId: process.env.GHL_LOCATION_ID,
  }, { headers });

  return res.data.contact;
}

// Add tag to contact
async function addTagToContact(contactId, tag) {
  await axios.post(`${GHL_BASE}/contacts/${contactId}/tags/`, {
    tags: [tag],
  }, { headers });
}

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const { client, job, visit, invoice } = req.body;
    const email = client?.email;
    const name = `${client?.first_name || ''} ${client?.last_name || ''}`.trim();

    if (!email) return res.status(400).json({ error: 'Missing client email' });

    const tag = mapJobberStatusToTag(job?.status, visit?.status, invoice?.status);

    if (!tag) return res.status(200).json({ message: 'No tag matched. Skipping.' });

    let contact = await findContactByEmail(email);
    if (!contact) {
      contact = await createContact({ name, email });
    }

    await addTagToContact(contact.id, tag);

    res.status(200).json({ success: true, tag });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('✅ Webhook server is running.');
});

app.listen(PORT, () => {
  console.log(`🚀 Server live on port ${PORT}`);
});
