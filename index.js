// index.js
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const GHL_BASE = 'https://rest.gohighlevel.com/v1';
const headers = {
  Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type': 'application/json'
};

async function findContactByEmail(email) {
  try {
    const res = await axios.get(`${GHL_BASE}/contacts/lookup?email=${email}`, { headers });
    return res.data.contact || null;
  } catch (err) {
    console.error('❌ Error finding contact:', err.response?.data || err.message);
    return null;
  }
}

async function createContact({ name, email }) {
  try {
    const res = await axios.post(`${GHL_BASE}/contacts/`, {
      firstName: name,
      email,
      locationId: process.env.GHL_LOCATION_ID
    }, { headers });
    return res.data.contact;
  } catch (err) {
    console.error('❌ Error creating contact:', err.response?.data || err.message);
    return null;
  }
}

async function addTagToContact(contactId, tag) {
  try {
    const res = await axios.post(`${GHL_BASE}/contacts/${contactId}/tags/`, {
      tags: [tag]
    }, { headers });
    return res.data;
  } catch (err) {
    console.error('❌ Error adding tag:', err.response?.data || err.message);
    return null;
  }
}

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

// Test endpoint
app.get('/', (req, res) => {
  res.send('✅ Webhook server running');
});

// Main webhook endpoint
app.post('/callback/jobber', async (req, res) => {
  try {
    console.log('📥 Incoming Webhook Payload:', req.body);

    const { client, job, visit, invoice } = req.body;
    const email = client?.email;
    const name = `${client?.first_name || ''} ${client?.last_name || ''}`.trim();

    if (!email) {
      return res.status(400).json({ error: 'Email required from Jobber webhook' });
    }

    const tag = mapJobberStatusToTag(job?.status, visit?.status, invoice?.status);
    if (!tag) {
      console.log('⚠️ No matching tag for statuses, skipping.');
      return res.status(200).json({ message: 'No tag matched, skipping.' });
    }

    let contact = await findContactByEmail(email);
    console.log('🔎 Found contact:', contact);

    if (!contact) {
      contact = await createContact({ name, email });
      console.log('✅ Created new contact:', contact);
    }

    if (contact?.id) {
      await addTagToContact(contact.id, tag);
      console.log('🏷️ Tag added:', tag);
      return res.status(200).json({ success: true, tag });
    } else {
      return res.status(500).json({ error: 'Failed to create or find contact' });
    }

  } catch (err) {
    console.error('❌ ERROR:', err?.response?.data || err.message || err);
    res.status(500).json({
      error: 'Internal error',
      message: err?.response?.data || err.message || err
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
