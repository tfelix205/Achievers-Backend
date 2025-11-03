exports.contributionReceivedMail = (name, groupName, amount, contributedAt) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contribution Received - Splita</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;background:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f5f5f5;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:40px 40px 30px;text-align:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">Splita</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 12px;color:#1a1a1a;font-size:20px;">Contribution Received</h2>
              <p style="margin:0 0 16px;color:#666;font-size:14px;">Hi ${name},</p>
              <p style="margin:0 0 8px;color:#666;font-size:14px;">
                You have successfully made a contribution of <strong>₦${amount}</strong> for the group <strong>${groupName}</strong>.
              </p>
              ${contributedAt ? `<p style="margin:0 0 12px;color:#666;font-size:13px;">Date: ${contributedAt}</p>` : ''}
              <p style="margin:0 0 16px;color:#666;font-size:14px;">Thank you for your payment, your contribution keeps the group moving.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #e5e5e5;">
              <p style="margin:0;color:#999;font-size:12px;">Need help? Contact us at <a href="mailto:support@splita.com" style="color:#667eea;">support@splita.com</a></p>
              <p style="margin:6px 0 0;color:#999;font-size:12px;">&copy; 2025 Splita. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
