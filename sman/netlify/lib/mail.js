const nodemailer = require("nodemailer");

function transporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("SMTP is not configured.");
  const port = parseInt(SMTP_PORT || "587", 10);
  return nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}
const from = () => process.env.MAIL_FROM || process.env.SMTP_USER;

async function sendConfirmation(reg, amountNgn, site) {
  const when = site.masterclass_date || "[Masterclass date to be confirmed by the academy]";
  const access = site.access_details || "[Access details to be confirmed by the academy]";
  const text =
`Hello ${reg.full_name},

Your payment has been verified and your registration for the Stock Masterclass Academy masterclass is confirmed.

Payment reference: ${reg.payment_reference}
Amount paid: ₦${Number(amountNgn).toLocaleString("en-NG")}
Masterclass date: ${when}

How to access the masterclass:
${access}

Questions? Reply to this email or write to ${site.contact_email}.

Stock Masterclass Academy
Learn. Invest. Grow.

Educational purposes only. No guaranteed investment returns.
`;
  await transporter().sendMail({ from: from(), to: reg.email, replyTo: site.contact_email,
                                 subject: "Your Stock Masterclass registration is confirmed", text });
}

async function sendContact(d, site) {
  await transporter().sendMail({ from: from(), to: site.contact_email, replyTo: d.email,
                                 subject: `Website enquiry from ${d.full_name}`,
                                 text: `From: ${d.full_name} <${d.email}>\n\n${d.message}\n` });
}

async function sendConsultationConfirmation(b, amountNgn, site, link) {
  const text =
`Hello ${b.full_name},

Your payment has been verified and your One-on-One Portfolio Consultation is booked.

Package: ${b.package_name}
Payment reference: ${b.payment_reference}
Amount paid: ₦${Number(amountNgn).toLocaleString("en-NG")}

NEXT STEP: submit your portfolio details so we can review them before your session:
${link}

Please do not send passwords, account logins or card numbers. Once we have your details, the academy will contact you to schedule your private consultation.

Questions? Reply to this email or write to ${site.contact_email}.

Stock Masterclass Academy
Learn. Invest. Grow.

Educational purposes only. No guaranteed investment returns.
`;
  await transporter().sendMail({ from: from(), to: b.email, replyTo: site.contact_email,
                                 subject: "Your portfolio consultation is booked: next step", text });
}

async function sendConsultationDetailsNotice(b, site) {
  await transporter().sendMail({ from: from(), to: site.contact_email, replyTo: b.email,
    subject: `Portfolio details received from ${b.full_name}`,
    text: `${b.full_name} <${b.email}> (${b.phone}) submitted portfolio details for the "${b.package_name}" consultation.\nReference: ${b.payment_reference}\n\nOpen the administrator dashboard to review the details and schedule the session.\n` });
}

module.exports = { sendConfirmation, sendContact, sendConsultationConfirmation, sendConsultationDetailsNotice };
