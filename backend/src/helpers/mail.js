// helpers/mail.js

const {
  createTransport,
  createTestAccount,
  getTestMessageUrl
} = require("nodemailer");

const {
  NODE_ENV,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  DEFAULT_MAIL_SENDER
} = process.env;

async function getTransporter() {
  let transporter;
  if (NODE_ENV !== "production") {
    const testAccount = await createTestAccount();
    transporter = createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  } else {
    transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD
      }
    });
  }
  return transporter;
}

async function sendMail(mail) {
  const payload = { ...mail };
  if (!payload.from) {
    payload.from = DEFAULT_MAIL_SENDER;
  }

  const transporter = await getTransporter();
  const mailInfo = await transporter.sendMail(payload);

  if (NODE_ENV !== "production") {
    console.log(`Mail Preview URL is ${getTestMessageUrl(mailInfo)}`);
  }

  return mailInfo;
}

module.exports = { sendMail };
