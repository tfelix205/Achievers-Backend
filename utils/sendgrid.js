
// require('dotenv').config(); 
// const sgMail = require('@sendgrid/mail');

// exports.sendEmail = async (user) => {
//     // Set your API Key
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// // Prepare the message
// const msg = {
//   to: user.email,
//   from: process.env.email, // must be a verified sender or domain
//   subject: user.subject,
//   html: user.html
// };

// // Send the email
// sgMail
//   .send(msg)
//   .then(() => {
//     console.log('Email sent successfully!');
//   })
//   .catch((error) => {
//     console.error('Error sending email:', error.response?.body || error);
//   });

// }










// const sendEmail = async (to, subject, html) => {
//   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//   try {
//     const msg = {
//       to,
//       from: process.env.email, // must be verified in SendGrid
//       subject,
//       html,
//     };
//     await sgMail.send(msg);
//     console.log(`✅ Email sent to ${to}`);
//   } catch (error) {
//     console.error('❌ SendGrid error:', error.response?.body || error.message);
//   }
// };

// module.exports = sendEmail;



require('dotenv').config()
const Brevo = require('@getbrevo/brevo');
const axios = require('axios');

const apiInstance = new Brevo.TransactionalEmailsApi();

const apiKey = apiInstance.authentications['apiKey'];

apiKey.apiKey = process.env.BREVO_API_KEY;
 


exports.sendMail = async (details) => {
  try {

   await axios.post('https://api.brevo.com/v3/smtp/email', {
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME },
    to: [{ email: details.email }],
    subject: details.subject,
    htmlContent: details.html
   }, {
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 10000,
   });

   console.log("Email sent successfully:", details.email);

  } catch (error) {
    console.error("Error sending email:", error.message);
    throw error;
  }
}
