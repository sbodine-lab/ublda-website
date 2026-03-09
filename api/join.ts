import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { firstName, lastName, email, major, year } = req.body

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'UBLDA Website <onboarding@resend.dev>',
      to: 'sbodine@umich.edu',
      subject: `UBLDA Membership: ${firstName} ${lastName}`,
      html: `
        <h2>New UBLDA Membership Sign-Up</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;">
          <tr><td style="padding:8px 16px;font-weight:bold;">Name</td><td style="padding:8px 16px;">${firstName} ${lastName}</td></tr>
          <tr><td style="padding:8px 16px;font-weight:bold;">Email</td><td style="padding:8px 16px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px 16px;font-weight:bold;">Major</td><td style="padding:8px 16px;">${major || 'N/A'}</td></tr>
          <tr><td style="padding:8px 16px;font-weight:bold;">Year</td><td style="padding:8px 16px;">${year || 'N/A'}</td></tr>
        </table>
      `,
    }),
  })

  if (!response.ok) {
    return res.status(500).json({ error: 'Failed to send email' })
  }

  return res.status(200).json({ success: true })
}
