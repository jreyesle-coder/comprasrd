import type { Metadata } from "next";
import { PaginaLegal } from "../pie";

export const metadata: Metadata = { title: "Términos del servicio" };

export default function Terminos() {
  return (
    <PaginaLegal titulo="Términos del servicio">
      <p>Estos términos regulan el uso del Radar de Compras Públicas RD (&quot;el Servicio&quot;) por parte de la empresa contratante (&quot;el Cliente&quot;) y sus usuarios.</p>
      <h2>1. Qué ofrece el Servicio</h2>
      <p>El Servicio recopila, clasifica y presenta información pública de procesos de compras del Estado dominicano obtenida de la API de Datos Abiertos de la Dirección General de Contrataciones Públicas (DGCP), y ofrece herramientas de seguimiento, alertas y análisis.</p>
      <h2>2. Fuente y exactitud de los datos</h2>
      <p>Los datos provienen de la DGCP y se actualizan varias veces al día. El Servicio no garantiza que la información esté completa, actualizada o libre de errores. Antes de presentar una oferta, el Cliente debe verificar fechas, montos, pliegos y requisitos en el portal oficial de Compras Dominicana. El Servicio es independiente y no tiene vínculo oficial con la DGCP.</p>
      <h2>3. Cuentas y acceso</h2>
      <p>El Cliente designa a sus usuarios y es responsable de su uso. Los enlaces de acceso son personales. El Cliente debe avisar si sospecha un acceso no autorizado.</p>
      <h2>4. Suscripción y pagos</h2>
      <p>La suscripción es mensual, por adelantado. Si el pago no se recibe en la fecha de vencimiento, el acceso se pausa; la información del Cliente se conserva al menos 90 días. No hay permanencia mínima: el Cliente puede cancelar en cualquier momento y el acceso se mantiene hasta el fin del período pagado.</p>
      <h2>5. Uso aceptable</h2>
      <p>No está permitido revender el acceso, extraer masivamente la información del Servicio ni usarlo para fines ilícitos.</p>
      <h2>6. Información del Cliente</h2>
      <p>Las notas, estados de seguimiento y configuraciones del Cliente le pertenecen y no se comparten con otros clientes.</p>
      <h2>7. Responsabilidad</h2>
      <p>El Servicio no es responsable por decisiones comerciales tomadas con base en la información presentada, ni por oportunidades no detectadas. La responsabilidad total se limita al monto pagado por el Cliente en los últimos tres meses.</p>
      <h2>8. Cambios</h2>
      <p>Estos términos pueden actualizarse; los cambios relevantes se notificarán por correo con al menos 15 días de anticipación.</p>
      <h2>9. Contacto</h2>
      <p>Para dudas sobre estos términos, escribe al correo de soporte indicado en tu factura.</p>
    </PaginaLegal>
  );
}
