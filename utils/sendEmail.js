// utils/sendEmail.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envía un correo electrónico utilizando la API de Resend.
 * @param {string} to - Dirección del destinatario.
 * @param {string} subject - Asunto del correo.
 * @param {string} html - Contenido HTML del correo.
 */
async function sendEmail(to, subject, html) {
  try {
    await resend.emails.send({
      from: 'no-reply@sigepgc.com',
      to,
      subject,
      html,
    });
    console.log(`✅ Email enviado correctamente a ${to}`);
  } catch (err) {
    console.error('❌ Error al enviar email:', err.message);
    throw new Error('No se pudo enviar el correo de recuperación');
  }
}

module.exports = sendEmail;
