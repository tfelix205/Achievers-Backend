
require('dotenv').config(); 
const sgMail = require('@sendgrid/mail');

exports.sendEmail = async (user) => {
    // Set your API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Prepare the message
const msg = {
  to: user.email,
  from: process.env.email, // must be a verified sender or domain
  subject: user.subject,
  html: user.html
};

// Send the email
sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent successfully!');
  })
  .catch((error) => {
    console.error('Error sending email:', error.response?.body || error);
  });

}