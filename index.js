import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// GHL API endpoint
const GHL_API_URL = 'https://rest.gohighlevel.com/v1/contacts';

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;

    console.log('Received from Jobber:', data); // ✅ Debug log

    const contactData = {
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || '',
      email: data.email,
      phone: data.phone,
    };

    // Send to GHL
    const ghlRes = await axios.post(GHL_API_URL, contactData, {
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Sent to GHL:', ghlRes.data); // ✅ Debug log

    res.status(200).json({ message: 'Contact sent to GHL successfully!' });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Root route for quick check
app.get('/', (req, res) => {
  res.send('Server is running ✅');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
