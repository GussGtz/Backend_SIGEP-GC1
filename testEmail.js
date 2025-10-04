const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    await resend.emails.send({
      from: 'no-reply@sigepgc.com',
      to: 'tucorreo@ejemplo.com',
      subject: 'Test Resend SIGEP GC',
      html: '<h2>✅ ¡Conexión correcta!</h2><p>Tu backend ya puede enviar correos.</p>',
    });
    console.log('✅ Correo enviado correctamente');
  } catch (err) {
    console.error('❌ Error al enviar correo:', err.message);
  }
}

test();
