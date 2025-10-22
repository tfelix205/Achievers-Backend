exports.passwordResetMail = (name, otp) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password - Splita</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
      <tr>
        <td style="padding: 40px 20px;">
          <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Splita</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 40px 30px;">
                <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px;">Reset Your Password</h2>
                <p style="margin: 0 0 24px; color: #666666; font-size: 16px;">Hi ${name}, To reset your password please enter the following code on Splita:</p>
                <div style="text-align: center; margin: 30px 0;">
                
                  <p  style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                 ${otp}
                  </p>
                </div>
                <p style="margin: 24px 0 16px; color: #666666; font-size: 14px;">This link will expire in <strong>15 minutes</strong>. If you didn’t request this, please ignore it.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px 40px 40px; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0 0 12px; color: #999999; font-size: 13px;">Need help? Contact us at <a href="mailto:support@splita.com" style="color: #667eea;">support@splita.com</a></p>
                <p style="margin: 0; color: #999999; font-size: 13px;">&copy; 2025 Splita. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
};